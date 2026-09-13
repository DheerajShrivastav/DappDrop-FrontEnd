import 'server-only'

import { ethers } from 'ethers'
import { Prisma } from '@prisma/client'
import config from '@/app/config'
import { prisma } from './prisma'
import { OnChainTaskType } from './task-types'
import { getEntrypointContract, getEntrypointReadContract } from './web3-service'
import { classifyAttestationConflict } from './signer-conflict'

/**
 * EIP-712 attestation signer service (PRD BR-V*). The single, server-only place that holds
 * the SIGNER_ROLE key and produces `TaskAttestation` signatures consumed by
 * `verifyTaskCompletionWithSignature`. Verifier routes call `attestTaskCompletion` on a PASS
 * outcome; they NEVER touch the key themselves.
 *
 * Trust posture (this is the highest-trust code in the app):
 * - Key access is a SINGLE chokepoint (`loadSigningWallet`). Swapping the env private key
 *   for a KMS signing call is a change to that one function, not a rewrite (Decision 1).
 * - The key, the raw signature bytes, and the message digest are NEVER logged or persisted.
 *   The audit log (AttestationRecord) stores who/what/when/evidence + signer ADDRESS only.
 * - The signature IS returned to the caller so a self-submit fallback works if the backend
 *   submitter is down/unfunded (BR-V3) — backend submission is never the only path.
 * - HOLD tasks (ONCHAIN_HOLD_ERC20/721) are rejected fast: the contract would revert
 *   TaskNotVerifiableByHost, but we never let that call reach the chain.
 *
 * FLAG (submitter/signer conflation): with only SIGNER_PRIVATE_KEY set, the same key both
 * signs and submits. A real deployment MUST set a separate SUBMITTER_PRIVATE_KEY so a
 * compromised submitter (hot, funded, exposed) cannot also forge attestations. See the
 * key-load functions.
 */

// ---------------------------------------------------------------------------
// EIP-712 domain + type (must match docs/TASK_VERIFICATION.md exactly)
// ---------------------------------------------------------------------------

const ATTESTATION_TYPES: Record<string, ethers.TypedDataField[]> = {
  TaskAttestation: [
    { name: 'campaignId', type: 'uint256' },
    { name: 'participant', type: 'address' },
    { name: 'taskIndex', type: 'uint256' },
    { name: 'completed', type: 'bool' },
    { name: 'version', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
}

// The canonical typehash string, for cross-checking against the on-chain
// TASK_ATTESTATION_TYPEHASH() in the test script.
export const ATTESTATION_TYPEHASH_STRING =
  'TaskAttestation(uint256 campaignId,address participant,uint256 taskIndex,bool completed,uint256 version,uint256 deadline)'

const DEADLINE_SECONDS = 60 * 60 // <= 1h shelf life for a stolen attestation (BR-V2)
const SIGN_COOLDOWN_MS = 5_000 // per-wallet abuse throttle (BR-V5)

export function attestationDomain(): ethers.TypedDataDomain {
  return {
    name: 'Web3Campaigns',
    version: '1',
    chainId: config.chainId,
    verifyingContract: config.addresses.entrypoint,
  }
}

// ---------------------------------------------------------------------------
// Errors — routes map these to HTTP statuses
// ---------------------------------------------------------------------------

export class SignerNotConfiguredError extends Error {
  constructor() {
    super('Attestation signing is not configured (SIGNER_PRIVATE_KEY unset)')
    this.name = 'SignerNotConfiguredError'
  }
}
export class SignerRejectedError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'SignerRejectedError'
  }
}
export class SignerRateLimitedError extends Error {
  constructor() {
    super('Too many attestation requests for this wallet — try again shortly')
    this.name = 'SignerRateLimitedError'
  }
}
export class SignerConcurrentRequestError extends Error {
  constructor() {
    super('Another verification for this task is already in progress — try again in a moment')
    this.name = 'SignerConcurrentRequestError'
  }
}

// ---------------------------------------------------------------------------
// Key access — the ONLY place key material is read. Swap to KMS here (Decision 1).
// ---------------------------------------------------------------------------

/** The SIGNER_ROLE signing wallet (no provider — signing is offline). */
function loadSigningWallet(): ethers.Wallet {
  const pk = process.env.SIGNER_PRIVATE_KEY
  if (!pk) throw new SignerNotConfiguredError()
  return new ethers.Wallet(pk)
  // KMS swap point: return a Wallet-compatible signer backed by a KMS signing API here,
  // keeping the rest of this module unchanged.
}

/**
 * The submitter wallet (funded, sends the tx). Falls back to the signing key when
 * SUBMITTER_PRIVATE_KEY is unset — that conflation is acceptable ONLY on this throwaway test
 * deployment (see the module FLAG above).
 */
function loadSubmitterWallet(provider: ethers.Provider): ethers.Wallet {
  const pk = process.env.SUBMITTER_PRIVATE_KEY || process.env.SIGNER_PRIVATE_KEY
  if (!pk) throw new SignerNotConfiguredError()
  return new ethers.Wallet(pk, provider)
}

function readProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(config.rpcUrl)
}

/** The signer's public address (safe to expose/log — it is NOT the key). */
export function signerAddress(): string {
  return loadSigningWallet().address
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type AttestationEvidence = Record<string, unknown>

export type AttestationResult = {
  attested: true
  campaignId: number
  taskIndex: number
  participant: string
  completed: boolean
  version: number
  deadline: number // unix seconds
  signature: string // returned for self-submit fallback; never logged/persisted
  submitted: boolean
  txHash?: string
  submitError?: string
}

/**
 * Verify-passed → attest. Reads the current on-chain version, signs the next-version
 * attestation, records an audit row, then best-effort submits it (returning the signature
 * either way so the client can self-submit).
 *
 * @throws SignerRejectedError for HOLD task types, SignerRateLimitedError, SignerNotConfiguredError
 */
export async function attestTaskCompletion(params: {
  campaignId: number
  participant: string
  taskIndex: number
  completed?: boolean
  evidence: AttestationEvidence
}): Promise<AttestationResult> {
  const completed = params.completed ?? true

  // Validate + checksum the participant address up front.
  let participant: string
  try {
    participant = ethers.getAddress(params.participant)
  } catch {
    throw new SignerRejectedError('Invalid participant address')
  }

  const entrypoint = getEntrypointReadContract()

  // 1. Fail-fast on HOLD tasks — read the AUTHORITATIVE on-chain task type (never trust a
  //    client-supplied type). The contract self-verifies these via completeTask and rejects
  //    the signature path (TaskNotVerifiableByHost).
  let onChainType: number
  try {
    const task = await entrypoint.getCampaignTask(params.campaignId, params.taskIndex)
    onChainType = Number(task.taskType)
  } catch {
    throw new SignerRejectedError('Task not found on-chain')
  }
  if (
    onChainType === OnChainTaskType.ONCHAIN_HOLD_ERC20 ||
    onChainType === OnChainTaskType.ONCHAIN_HOLD_ERC721
  ) {
    throw new SignerRejectedError(
      'Hold tasks are self-verified via completeTask and cannot be attested by the signer',
    )
  }

  // 2. Per-wallet rate limit (BR-V5).
  // Scoped to THIS (campaign, task, wallet) — not the wallet globally, so completing one
  // task never throttles an unrelated task/campaign for the same participant.
  const recent = await prisma.attestationRecord.findFirst({
    where: {
      participant: participant.toLowerCase(),
      campaignId: params.campaignId,
      taskIndex: params.taskIndex,
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (recent && Date.now() - recent.createdAt.getTime() < SIGN_COOLDOWN_MS) {
    throw new SignerRateLimitedError()
  }

  // 3. Read the current version and target current+1 (the replay/update guard, BR-V2).
  const currentVersion: bigint = await entrypoint.getTaskAttestationVersion(
    params.campaignId,
    participant,
    params.taskIndex,
  )
  const nextVersion = currentVersion + BigInt(1)
  const deadline = Math.floor(Date.now() / 1000) + DEADLINE_SECONDS

  // 4. Sign (offline). The digest/signature are never logged.
  const wallet = loadSigningWallet()
  const value = {
    campaignId: BigInt(params.campaignId),
    participant,
    taskIndex: BigInt(params.taskIndex),
    completed,
    version: nextVersion,
    deadline: BigInt(deadline),
  }
  const signature = await wallet.signTypedData(attestationDomain(), ATTESTATION_TYPES, value)

  // 5. Append-only audit record (no signature, no key material) — BR-V4. The unique
  //    constraint on (campaignId, taskIndex, participant, version) is the concurrency guard:
  //    two near-simultaneous requests can both read the same currentVersion and both sign
  //    it, but only the first INSERT wins.
  //
  //    A P2002 here has two different causes that need different handling:
  //    (a) a GENUINE live race — a second request landed microseconds after the first and
  //        lost the insert. The loser must be rejected (SignerConcurrentRequestError) —
  //        proceeding would resubmit a signature the winner may already be submitting,
  //        doubling relayer/gas work for one completion.
  //    (b) a RETRY after a previous attempt signed successfully but never got submitted
  //        (relayer down/unfunded, or the client lost the signature before self-submitting).
  //        The version is still pending (nothing was ever accepted on-chain), so it's safe
  //        to sign again for that SAME version — but with a FRESH deadline, not the stored
  //        one: reusing a deadline that may already have expired would produce a signature
  //        doomed to revert Web3Campaigns__SignatureExpired, and since nothing ever gets
  //        accepted the version never advances, so every future retry would collide on the
  //        same row and reproduce the same expired signature — a permanent deadlock. We
  //        recover instead: re-sign the EXISTING record's (version, completed) with a new
  //        deadline, persist it on the row, and retry submission.
  //
  //    The rate limiter above already rejects any request within SIGN_COOLDOWN_MS of the
  //    last record for this (campaign, task, wallet), so by construction a request that
  //    reaches this insert is either a genuine same-instant race (the colliding record is
  //    only microseconds old — younger than the cooldown could have let a legitimate retry
  //    through) or a legitimate retry (old enough that the rate limiter already let it
  //    pass). That age is exactly how we disambiguate (a) from (b) below.
  let record: { id: string }
  let signedVersion = nextVersion
  let signedCompleted = completed
  let signedDeadline = deadline
  let finalSignature = signature
  try {
    record = await prisma.attestationRecord.create({
      data: {
        campaignId: params.campaignId,
        taskIndex: params.taskIndex,
        participant: participant.toLowerCase(),
        completed,
        version: Number(nextVersion),
        deadline: new Date(deadline * 1000),
        signerAddress: wallet.address,
        evidence: params.evidence as object,
        submitted: false,
      },
    })
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') {
      throw e
    }

    const existing = await prisma.attestationRecord.findUnique({
      where: {
        campaignId_taskIndex_participant_version: {
          campaignId: params.campaignId,
          taskIndex: params.taskIndex,
          participant: participant.toLowerCase(),
          version: Number(nextVersion),
        },
      },
    })
    if (!existing) {
      // The row that caused the conflict vanished (shouldn't happen) — fail safe.
      throw new SignerConcurrentRequestError()
    }

    // Re-verify the on-chain version hasn't moved past this one. If it has, something else
    // (a different attestation, a revocation) already consumed this slot and the existing
    // row is stale — no signature for it can ever be accepted again.
    const liveVersion: bigint = await entrypoint.getTaskAttestationVersion(
      params.campaignId,
      participant,
      params.taskIndex,
    )

    const resolution = classifyAttestationConflict({
      existing: {
        createdAt: existing.createdAt,
        submitted: existing.submitted,
        version: existing.version,
      },
      liveVersionOnChain: liveVersion,
      cooldownMs: SIGN_COOLDOWN_MS,
    })
    if (resolution.action === 'reject') {
      throw new SignerConcurrentRequestError()
    }

    // Safe retry: same (campaignId, taskIndex, participant, version) — reproducing the
    // BYTE-IDENTICAL original signature was never required, only a VALID, non-expired one
    // over that still-pending version. Reusing the row's stored deadline verbatim is
    // actively wrong: if the retry happens more than DEADLINE_SECONDS after the original
    // signing (the realistic case — the rate limiter already forces retries to be old
    // enough to reach this branch), that deadline has already passed, so the re-signed
    // attestation would revert Web3Campaigns__SignatureExpired on submission — and since
    // nothing ever gets accepted, the version never advances, so EVERY future retry would
    // collide on this same row and reproduce the same expired signature: a permanent
    // deadlock for this participant/task with no recovery but manual DB intervention.
    // Instead: sign a FRESH deadline for the same version and persist it on the row. A
    // stale earlier signature (if it somehow lands later, e.g. a delayed self-submit)
    // simply reverts on version mismatch once this one is accepted — harmless.
    record = { id: existing.id }
    signedVersion = BigInt(existing.version)
    signedCompleted = existing.completed
    signedDeadline = Math.floor(Date.now() / 1000) + DEADLINE_SECONDS
    finalSignature = await wallet.signTypedData(attestationDomain(), ATTESTATION_TYPES, {
      campaignId: BigInt(params.campaignId),
      participant,
      taskIndex: BigInt(params.taskIndex),
      completed: signedCompleted,
      version: signedVersion,
      deadline: BigInt(signedDeadline),
    })
    await prisma.attestationRecord.update({
      where: { id: existing.id },
      data: { deadline: new Date(signedDeadline * 1000) },
    })
  }

  // 6. Best-effort backend submission (BR-V3). Never throw on submit failure — the caller
  //    still gets the signature to self-submit.
  let submitted = false
  let txHash: string | undefined
  let submitError: string | undefined
  try {
    const submitter = loadSubmitterWallet(readProvider())
    const contract = getEntrypointContract(submitter)
    const tx = await contract.verifyTaskCompletionWithSignature(
      params.campaignId,
      participant,
      params.taskIndex,
      signedCompleted,
      signedDeadline,
      finalSignature,
    )
    const receipt = await tx.wait()
    submitted = true
    txHash = receipt?.hash
    await prisma.attestationRecord.update({
      where: { id: record.id },
      data: { submitted: true, txHash },
    })
  } catch (e) {
    // Redacted: only a short reason, never the signature or key.
    submitError =
      (e as { shortMessage?: string })?.shortMessage ||
      (e as Error)?.message ||
      'submission failed'
  }

  return {
    attested: true,
    campaignId: params.campaignId,
    taskIndex: params.taskIndex,
    participant,
    completed: signedCompleted,
    version: Number(signedVersion),
    deadline: signedDeadline,
    signature: finalSignature,
    submitted,
    txHash,
    submitError,
  }
}
