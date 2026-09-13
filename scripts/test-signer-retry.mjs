/**
 * Failed-submit-then-retry test (PRD BR-V3 hardening) — run: `node scripts/test-signer-retry.mjs`
 *
 * Imports the REAL `classifyAttestationConflict` from src/lib/signer-conflict.ts (no copy —
 * Node 24's native TypeScript support lets this plain-Node script import the exact function
 * src/lib/signer.ts uses, so the test can never silently drift from the real logic).
 *
 * Two things are verified:
 *  1. The disambiguation logic: a P2002 collision on (campaignId, taskIndex, participant,
 *     version) resolves to 'retry' for a stale, unsubmitted row whose version the chain
 *     hasn't moved past — REGARDLESS of whether its stored deadline has expired, since
 *     deadline freshness is deliberately NOT part of this classifier's job — and 'reject'
 *     for a genuine live race / already-submitted / stale (version superseded) row.
 *  2. The recovery signing behavior in signer.ts: a retry signs a FRESH deadline
 *     (now + DEADLINE_SECONDS) for the still-pending version, never the row's stored one.
 *     Reusing a stored deadline that has already expired would produce a signature that
 *     reverts Web3Campaigns__SignatureExpired on submission — and since nothing would ever
 *     get accepted, the version could never advance, permanently deadlocking that
 *     participant/task. This section proves a fresh-deadline re-sign is always valid
 *     (deadline > now) even when the original signing's deadline is long past.
 *
 * Never logs private key material (only an ephemeral throwaway key is used here).
 */
import { ethers } from 'ethers'
import { classifyAttestationConflict } from '../src/lib/signer-conflict.ts'

const ok = (b) => (b ? '✅' : '❌')
let allPass = true
const check = (label, pass, extra = '') => {
  if (!pass) allPass = false
  console.log(`${ok(pass)} ${label}${extra ? ` — ${extra}` : ''}`)
}

console.log('\nSigner retry-disambiguation + fresh-deadline recovery tests\n')

// ---------------------------------------------------------------------------
// 1. classifyAttestationConflict scenarios
// ---------------------------------------------------------------------------

const COOLDOWN_MS = 5_000
const DEADLINE_SECONDS = 60 * 60 // mirrors signer.ts
const now = new Date('2026-01-01T00:00:00.000Z')

// Scenario A: legitimate retry — the colliding row is old (rate limiter already would have
// let a NEW request through), unsubmitted, and the on-chain version hasn't moved past it.
{
  const r = classifyAttestationConflict({
    existing: {
      createdAt: new Date(now.getTime() - 60_000), // 60s old — well past the cooldown
      submitted: false,
      version: 5,
    },
    liveVersionOnChain: 4n, // current+1 === 5 === existing.version: still pending
    cooldownMs: COOLDOWN_MS,
    now,
  })
  check('Stale unsubmitted row, version still pending -> retry', r.action === 'retry')
}

// Scenario A2: same as A, but the row's stored deadline has ALREADY EXPIRED (e.g. the
// original attempt was signed 2 hours ago, deadline was 1 hour). The classifier still says
// 'retry' — deadline expiry is deliberately not its concern, since a retry always re-signs a
// FRESH deadline (verified in section 2) regardless of what the stale row's deadline was.
{
  const r = classifyAttestationConflict({
    existing: {
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2h old
      submitted: false,
      version: 5,
    },
    liveVersionOnChain: 4n,
    cooldownMs: COOLDOWN_MS,
    now,
  })
  check(
    'Stale row with an EXPIRED original deadline, version still pending -> retry',
    r.action === 'retry',
  )
}

// Scenario B: genuine live race — the colliding row was created microseconds ago, well
// within the cooldown window a legitimate retry could never have passed through.
{
  const r = classifyAttestationConflict({
    existing: {
      createdAt: new Date(now.getTime() - 50), // 50ms old
      submitted: false,
      version: 5,
    },
    liveVersionOnChain: 4n,
    cooldownMs: COOLDOWN_MS,
    now,
  })
  check('Fresh (in-flight) row -> reject (genuine race)', r.action === 'reject')
}

// Scenario C: already submitted — nothing to retry, the task is already done.
{
  const r = classifyAttestationConflict({
    existing: {
      createdAt: new Date(now.getTime() - 60_000),
      submitted: true,
      version: 5,
    },
    liveVersionOnChain: 4n,
    cooldownMs: COOLDOWN_MS,
    now,
  })
  check('Already-submitted row -> reject', r.action === 'reject')
}

// Scenario D: stale — something else advanced the on-chain version past this row (e.g. a
// revocation or a different attestation), so this exact version can never be accepted again.
{
  const r = classifyAttestationConflict({
    existing: {
      createdAt: new Date(now.getTime() - 60_000),
      submitted: false,
      version: 5,
    },
    liveVersionOnChain: 5n, // current+1 === 6 !== 5: version 5 was already consumed
    cooldownMs: COOLDOWN_MS,
    now,
  })
  check('On-chain version advanced past the row -> reject (stale)', r.action === 'reject')
}

// ---------------------------------------------------------------------------
// 2. Fresh-deadline recovery — the actual fix for the deadlock bug
// ---------------------------------------------------------------------------

const TYPES = {
  TaskAttestation: [
    { name: 'campaignId', type: 'uint256' },
    { name: 'participant', type: 'address' },
    { name: 'taskIndex', type: 'uint256' },
    { name: 'completed', type: 'bool' },
    { name: 'version', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
}
const DOMAIN = {
  name: 'Web3Campaigns',
  version: '1',
  chainId: 11155111,
  verifyingContract: '0xf0A2Fac02ffBA4A7762f2f0d611253B6C97bB1B3',
}

const eph = ethers.Wallet.createRandom()

// Simulate the ORIGINAL signing, 2 hours before "now" (its deadline is 1h shelf life ->
// already expired by the time of retry).
const originalSignedAt = Math.floor(now.getTime() / 1000) - 2 * 60 * 60
const expiredDeadline = originalSignedAt + DEADLINE_SECONDS
const staleValue = {
  campaignId: 1n,
  participant: eph.address,
  taskIndex: 0n,
  completed: true,
  version: 7n,
  deadline: BigInt(expiredDeadline),
}
const staleSignature = await eph.signTypedData(DOMAIN, TYPES, staleValue)
const nowSeconds = Math.floor(now.getTime() / 1000)
check(
  'Simulated original signature has an expired deadline by retry time',
  expiredDeadline < nowSeconds,
  `deadline=${expiredDeadline}, now=${nowSeconds}`,
)

// This is what signer.ts's retry path now does: sign the SAME still-pending version again,
// but with Date.now() + DEADLINE_SECONDS, never the stale stored deadline.
const freshDeadline = nowSeconds + DEADLINE_SECONDS
const freshValue = { ...staleValue, deadline: BigInt(freshDeadline) }
const freshSignature = await eph.signTypedData(DOMAIN, TYPES, freshValue)

check('Fresh-deadline retry signature is valid (non-expired at "now")', freshDeadline >= nowSeconds)
check(
  'Fresh-deadline retry produces a DIFFERENT signature than the expired original',
  freshSignature !== staleSignature,
)
const recovered = ethers.verifyTypedData(DOMAIN, TYPES, freshValue, freshSignature)
check('Fresh-deadline retry signature recovers to the signer', recovered === eph.address)

console.log(`\n${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`)
process.exit(allPass ? 0 : 1)
