# Decisions Memo — answers to the v0.6.0 gap-analysis open questions

> Companion to [GAP_ANALYSIS_v0.6.0.md](GAP_ANALYSIS_v0.6.0.md). These are the founder-confirmed
> answers to the three decisions that gap analysis surfaced (§9 + the Telegram flag). **None of
> these require a contract change** — all verified against the deployed v0.6.0 source.
> Implement against these; where a PRD open question still has no answer, keep the gap analysis's
> "smallest reasonable default + flag" rule.

---

## Decision 1 — Role rotation (SIGNER_ROLE / SETTLER_ROLE)

**Do not rotate the current Sepolia deployment.** `docs/deployments/sepolia.md` in the contract repo
labels it a throwaway/test deployment; key hygiene on a disposable testnet rig buys nothing.

- **During dev (now):** the backend signer service may use the **deployer key** as its `SIGNER_ROLE`
  signer against this test deployment. It's a testnet, test key, disposable.
- **At the real beta deployment (later):** grant `SIGNER_ROLE` and `SETTLER_ROLE` **directly to
  dedicated backend addresses at deploy time** (the contract-repo deploy script will add
  `SIGNER_ADDRESS` / `SETTLER_ADDRESS` env vars), so those roles never sit on the deployer key in
  the deployment the app actually ships against.
- **Custody model to build toward (PRD BR-V4):** the signer key is **KMS-backed** — the signer
  service signs via a KMS API, never holds plaintext key material in env or memory, and writes an
  append-only audit log of every signature (who/what/when/evidence). The settler key can be a plain
  backend hot key (it only ever acts after a 14-day delay — low urgency, small blast radius).

**Backend impact now:** build the signer service so its signing key is a **config value**
(env/KMS handle), not hardcoded — so pointing it at the deployer key today and a KMS key at beta is
a config change, not a code change. Nothing else to do for this decision.

---

## Decision 2 — Telegram tasks: on-chain first-class via a metadata-authoritative taxonomy

**Verified contract behavior (this is why the fix is clean):** `_verifySingleTaskCompletion`
(`ParticipantManagement.sol`) rejects **only** `ONCHAIN_HOLD_ERC20` / `ONCHAIN_HOLD_ERC721` on the
signed-attestation path. Every other task type is accepted **without the contract validating which
type it is** — the attestation binds to `taskIndex`, not task type, and just marks that index
complete. **For any off-chain task the on-chain enum is advisory; the backend verifier decides what
is actually checked.**

### The design

1. **App-level task taxonomy lives in off-chain metadata (`CampaignTaskMetadata`), which is
   authoritative.** Add:
   - `platform`: `twitter | discord | telegram | …` (extensible — add new platforms here, never in
     the on-chain enum, which is immutable)
   - `verificationMethod`: how the backend verifier confirms completion
   The frontend renders from this and the backend verifier routes on this. It already *must* —
   the on-chain enum cannot express "follow @handle" vs "join t.me/channel".

2. **On-chain, a Telegram task is created as `DISCORD_JOIN`.** Treat that enum slot as the generic
   "join a community chat" bucket; Discord and Telegram both map to it and are disambiguated
   entirely by `metadata.platform`. It is a deliberate lossy projection — nothing functional keys
   off the raw enum for attested tasks. **Do NOT repurpose a wrong-named slot like `WALLET_CONNECT`**
   — that is more confusing, not less.

3. **Verification flow — identical to Discord:** participant links Telegram (existing Telegram
   OAuth/bot verifier — still valid) → backend confirms channel membership → backend reads
   `getTaskAttestationVersion(campaignId, participant, taskIndex)`, signs the `TaskAttestation` for
   that index (version = current + 1, short deadline), submits via
   `verifyTaskCompletionWithSignature`. The contract records it with no knowledge that it's Telegram.
   The old `completeTask`-based recording is removed for Telegram (as for all attested tasks).

### Why on-chain first-class (not off-chain-only)

Telegram becomes a **full peer of Discord**: it can be a **required task on a tiered on-chain
campaign** (where qualification is enforced on-chain via required tasks) — which an off-chain-only
Telegram requirement could never gate. It also still supports Merkle tree-build filtering (the
backend can additionally require Telegram membership at allocation time, exactly like Humanity
gating) if a host wants it.

### The one rule to enforce

**Indexer and analytics must key task identity off `metadata.platform`, never the raw on-chain
`taskType`** — otherwise Discord and Telegram blur in reporting (they share the `DISCORD_JOIN`
enum on-chain). Since the app already joins on-chain task data with metadata to render anything,
this is a convention to document, not new work.

### Canonical taxonomy mapping table (define in frontend config, one place)

App-facing task type → on-chain `TaskType` enum → settlement path:

| App task type | `metadata.platform` | On-chain `TaskType` | Enum # | Settlement |
|---|---|---|---|---|
| Twitter/X follow | `twitter` | `SOCIAL_FOLLOW` | 0 | Signed attestation |
| Twitter/X like | `twitter` | `SOCIAL_LIKE` | 1 | Signed attestation |
| Twitter/X retweet | `twitter` | `SOCIAL_RETWEET` | 2 | Signed attestation |
| Twitter/X post | `twitter` | `SOCIAL_POST` | 3 | Signed attestation |
| Discord join | `discord` | `DISCORD_JOIN` | 4 | Signed attestation |
| **Telegram join** | **`telegram`** | **`DISCORD_JOIN`** | **4** | **Signed attestation** |
| Wallet connect | `wallet` | `WALLET_CONNECT` | 5 | Signed attestation |
| Humanity verification | `humanity` | `HUMANITY_VERIFICATION` | 6 | Signed attestation (auto, in Humanity OAuth callback) |
| On-chain tx | `onchain` | `ONCHAIN_TX` | 7 | Signed attestation (backend indexes the tx) |
| Hold ERC20 | `onchain` | `ONCHAIN_HOLD_ERC20` | 8 | **Self-verify** via `completeTask` (64-byte `abi.encode(address,uint256)`; always costs the participant gas) |
| Hold ERC721 | `onchain` | `ONCHAIN_HOLD_ERC721` | 9 | **Self-verify** via `completeTask` (64-byte `abi.encode(address,uint256)`) |

- Only `ONCHAIN_HOLD_ERC20` (8) and `ONCHAIN_HOLD_ERC721` (9) use the self-verify `completeTask`
  path; everything else is a signed attestation. This split is enforced by the contract.
- `DISCORD_JOIN` (4) appears twice by design — the on-chain enum is a lossy projection;
  `metadata.platform` is the discriminator.
- The enum has exactly these 10 values in this order (`CampaignStorage.sol`). It is immutable —
  future task types are added to the app taxonomy + `metadata.platform`, mapped onto the nearest
  existing enum slot, never by expecting a new on-chain value.

---

## Decision 3 — Indexer architecture: rebuilt subgraph for P0, dedicated indexer as the P1/P2 backing store

- **P0 — rebuild the existing The Graph subgraph against v0.6.0** to unblock discovery quickly:
  - New entrypoint address `0xf0A2Fac02ffBA4A7762f2f0d611253B6C97bB1B3`, startBlock `11314275`.
  - The full v0.6.0 event set (re-derived from the v0.6.0 ABIs — old `RewardSet`/`RewardClaimed` are
    gone; new events include `CampaignFundedERC20`, `ProtocolFeeCollected`, `ERC20MerkleRootSet`,
    `ERC20RewardClaimed`, `TaskVerifiedWithSignature`, `RewardModulePinned`, `NFTModulePinned`,
    `MaxParticipantsUpdated`, `UnclaimedERC20Swept`, `FallbackRootPublished`/`FallbackClosed`, …).
  - **Satellite events indexed per pinned-module address**: index `RewardModulePinned` /
    `NFTModulePinned` to discover each campaign's module instances, then index that instance's own
    events via a **data-source-template** pattern (`NFTSettlementModule`:
    `NFTMerkleRootSet`/`NFTRewardClaimed`/`UnclaimedNFTsWithdrawn`; `OnChainRewardModule`: tier
    configs + `claimReward`).
  - Reuse the existing `graph-service.ts` fast-path-with-RPC-fallback client shape; re-derive every
    query/entity from v0.6.0.

- **P1/P2 — stand up the dedicated materialized-state indexer** the PRD's BR-I* describes (≤5s
  freshness, reorg `finalized` flags, SSE/WebSocket push). The **keeper (BR-K) and notification
  (BR-N) services read from this**, not the subgraph — they need push/freshness the subgraph can't
  give. The subgraph's schema and mappings port largely intact into this indexer's ingestion logic,
  so P0 is a stepping stone, not throwaway work.

- **The rule that makes running both safe (PRD BR-I4) — build it in from day one:** never let
  either indexer be authoritative for a **value-bearing decision**. Allocation totals,
  dispute-window expiry, sweep availability, claim eligibility — **re-verify against a direct RPC
  read at execution time**. The indexers are for display and scheduling; the chain is for money.
  This makes the subgraph → dedicated-indexer migration incapable of ever causing a wrong payout.

---

## Standing PRD open questions (unchanged — keep default + flag)

Not decided here; implement the smallest reasonable default and flag (per gap analysis §9):
- **Q2 protocol fee** — fees off at beta (FeeModule not deployed); itemize gross = net.
- **Q3 allocation policy** — default equal-split among qualifiers, policy shown pre-Open.
- **Q6 relayer budgets, Q7 email scope, Q9 discovery curation** — defaults per gap analysis; surface for founder input at their phase.
