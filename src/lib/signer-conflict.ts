/**
 * Pure decision logic for resolving a unique-constraint collision on `AttestationRecord`
 * (campaignId, taskIndex, participant, version). Deliberately has NO dependency on
 * 'server-only', Prisma, or ethers — it touches no key material and no I/O, so it is safe to
 * import from a plain Node test script (scripts/test-signer-retry.mjs) as well as from
 * src/lib/signer.ts, keeping the test and the real logic byte-for-byte the same function
 * instead of two copies that can drift.
 *
 * Two different situations produce the same P2002 in signer.ts, and must be told apart:
 * - a GENUINE live race: a second request lost the insert to one that landed microseconds
 *   earlier — must be rejected, or two parties could both submit for the same version.
 * - a RETRY after a prior attempt signed successfully but was never submitted (relayer
 *   down/unfunded, or the client lost the signature) — safe to recover by signing the SAME
 *   still-pending version again with a FRESH deadline (the caller, not this module, is
 *   responsible for using a new deadline rather than the stale stored one — reusing an
 *   expired deadline would produce a signature that reverts SignatureExpired on submission,
 *   and since nothing would ever get accepted the version could never advance, permanently
 *   deadlocking this participant/task).
 */

export type ExistingAttestation = {
  createdAt: Date
  submitted: boolean
  /** The version number stored on the colliding row. */
  version: number
}

export type ConflictResolution =
  | { action: 'retry' }
  | { action: 'reject' }

/**
 * @param existing The row that already occupies (campaignId, taskIndex, participant, version).
 * @param liveVersionOnChain A FRESH `getTaskAttestationVersion` read (not cached) — used to
 *   confirm the on-chain version hasn't moved past `existing.version` since it was signed.
 * @param cooldownMs The same window the rate limiter uses (SIGN_COOLDOWN_MS). A colliding row
 *   younger than this could only exist because a second request arrived while the first was
 *   still in flight — the rate limiter would have blocked anything older from ever reaching
 *   this collision, so age is a reliable race/retry discriminator.
 * @param now Injectable for tests; defaults to the real clock.
 */
export function classifyAttestationConflict(params: {
  existing: ExistingAttestation
  liveVersionOnChain: bigint
  cooldownMs: number
  now?: Date
}): ConflictResolution {
  const now = params.now ?? new Date()
  const ageMs = now.getTime() - params.existing.createdAt.getTime()
  const stillFreshRace = ageMs < params.cooldownMs

  // The existing row's version must still be exactly "current on-chain + 1" — if the chain
  // has moved past it, something else already consumed that slot and it can never be
  // accepted again, regardless of how old the row is.
  const stillPending =
    params.liveVersionOnChain + BigInt(1) === BigInt(params.existing.version)

  if (params.existing.submitted || stillFreshRace || !stillPending) {
    return { action: 'reject' }
  }
  return { action: 'retry' }
}
