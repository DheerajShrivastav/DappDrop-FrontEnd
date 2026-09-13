# Gap Analysis — Frontend/Backend vs. Web3Campaigns v0.6.0

> **Phase 1 deliverable. No code has been changed.** This audits every place the
> existing app touches the chain and maps each to: **still-valid / changed /
> removed / missing**, against the v0.6.0 contract suite and the PRD.
>
> Sources of truth: contract ABIs at `Dapp-Drop-Smart-Contract/out/` (v0.6.0 tag),
> `docs/{ARCHITECTURE,REWARD_SYSTEM,TASK_VERIFICATION,HUMANITY_GATING,DEPLOYMENT}.md`,
> `docs/deployments/sepolia.md`, and `PRD.md`. Line numbers drift — re-verify before editing.

## 0. TL;DR — the app is built against a pre-escrow contract

The current frontend ABI (`src/lib/abi/Web3Campaigns.json`) is a **v0.0.3-era ABI**:
it has `createCampaignWithTasksAndReward`, `setCampaignReward`, `verifyTaskCompletion`,
`claimReward`, `hasClaimedReward`, a `reward` field inside the `Campaign` struct, and a
6-value `TaskType` enum. **None of that exists in v0.6.0.** The contract was rebuilt
around escrow + post-end Merkle/tiered settlement + EIP-712 signed attestations + 4
separate deployed contracts. The integration is not "subtly stale" — the write path,
the reward model, the verification model, the struct shape, the event schema, the
deployed addresses, and the task-type enum are all wrong.

Practically: **P0 (indexer + read discovery) and P1 (Merkle-ERC20 loop) are effectively
greenfield**; a handful of read helpers and all the off-chain metadata/DB/OAuth
plumbing survive.

---

## 1. Deployed addresses & config

| Item | Current app | v0.6.0 reality | Verdict |
|---|---|---|---|
| Entrypoint address | `NEXT_PUBLIC_CAMPAIGN_FACTORY_CONTRACT` (env) | `Web3Campaigns 0xf0A2Fac0…1B3` (Sepolia, block 11314275) | **Changed** — set env to the new address; config is address-driven so no code change, but the value in `.env` is stale. |
| Satellite modules | none configured | `OnChainRewardModule 0x1674…35B4`, `NFTSettlementModule 0xf85F…9747`, `FeeModule` not deployed (fees off) | **Missing** — config has no concept of satellites. Per-campaign pinned modules must come from `getCampaignNFTModule(id)`/`getCampaignRewardModule(id)`, **never** hardcoded (NFR-2). |
| Chain config | `config.chainId`, `rpcUrl` (defaults Sepolia 11155111) | Sepolia now, single L2 later | **Still-valid** — already config-driven (NFR-1). Add RPC failover (NFR-3) later. |
| `src/app/config.ts` | one entrypoint address | needs an address book (entrypoint + 3 modules + deploy block), versioned | **Changed** — extend to a module address book (NFR-2). |

**Flag:** the deployed Sepolia instance still has `SIGNER_ROLE`/`SETTLER_ROLE` on the
deployer key (`docs/deployments/sepolia.md`). Backend signer work (P1) is blocked until
those are rotated to dedicated backend keys — a deployment/ops action, not a code change.

---

## 2. ABI & contract-surface mapping

### 2.1 Removed — code that calls these is dead

| Old call (in app) | Status in v0.6.0 | Replacement |
|---|---|---|
| `createCampaignWithTasksAndReward(...)` (single-tx create+reward) — `web3-service.ts:877` | **Gone** | Multi-step Draft flow: `createCampaign` → `batchAddTasks`/`addTaskToCampaign` → reward config (`configureERC20Reward` + `fundCampaignERC20`, or module `setRankTiers`/`setScoreTiers`, or `depositERC721/1155Rewards`) → `openCampaign` (FR-H2…H6). |
| `setCampaignReward(...)` | **Gone** | `configureERC20Reward(id, token)` then `fundCampaignERC20(id, amount)`; NFT via deposits; tiered via module. |
| `verifyTaskCompletion` / `batchVerifyTaskCompletion` (host-tx) | **Gone** | `verifyTaskCompletionWithSignature` / `batchVerifyTaskCompletionWithSignatures` — EIP-712 attestations from a `SIGNER_ROLE` backend key (§3, TASK_VERIFICATION.md). |
| `claimReward(id)` (direct pay) | **Gone from entrypoint** (name now exists only on `OnChainRewardModule` for tiered) | Merkle ERC20: `claimERC20(id, amount, proof)`. NFT: `NFTSettlementModule.claimNFT(...)`. Tiered: `OnChainRewardModule.claimReward(id)`. |
| `hasClaimedReward(id, addr)` | Present but semantically obsolete for Merkle | `hasClaimedERC20(id, account)`; NFT `isNFTLeafClaimed`. |
| `Campaign.reward` struct field — read at `web3-service.ts:182,268,272,273` and written at `:858` | **Removed from the struct** | Reward data now lives in settlement views: `getERC20Settlement(id)`, module state, escrow events. `mapContractDataToCampaign` **will throw** on `contractData.reward.rewardType` (undefined). |
| `TaskType` map `{SOCIAL_FOLLOW:0, JOIN_DISCORD:1, JOIN_TELEGRAM:2, RETWEET:3, ONCHAIN_TX:4, HUMANITY_VERIFICATION:5}` — `web3-service.ts:828`, `types.ts:3` | **Wrong numbering & wrong set** | v0.6.0 enum (10 values): `0 SOCIAL_FOLLOW, 1 SOCIAL_LIKE, 2 SOCIAL_RETWEET, 3 SOCIAL_POST, 4 DISCORD_JOIN, 5 WALLET_CONNECT, 6 HUMANITY_VERIFICATION, 7 ONCHAIN_TX, 8 ONCHAIN_HOLD_ERC20, 9 ONCHAIN_HOLD_ERC721`. |
| `MAX_PARTICIPANTS`, `JOIN_COOLDOWN` constants | Renamed/removed | `MAX_PARTICIPANTS_LIMIT` (100k ceiling), per-campaign `setMaxParticipants`/`getMaxParticipants`; `JOIN_COOLDOWN` removed. |

**Flag — Telegram has no on-chain task type.** The app treats `JOIN_TELEGRAM` as a
first-class task (enum value, DB metadata, verifier). The v0.6.0 enum has **no Telegram
member**. Options: (a) drop Telegram tasks, (b) represent them off-chain only with no
on-chain task record, or (c) map to a generic type. **This is a product decision — surfacing, not deciding.** (Related PRD open question territory; not in §6, so needs founder input.)

**Flag — `completeTask` is now self-verify-only.** In v0.6.0 `completeTask` only accepts
`ONCHAIN_HOLD_ERC20/721` (self-verified in-tx). For any task an attestation has ever
touched it reverts `TaskManagedBySignature`. The app currently calls `completeTask` for
*every* task type (`web3-service.ts:1783`, with stale comments citing "type 4/5"). Social/
on-chain-tx tasks must instead settle via a backend-signed attestation. **The client no
longer writes task completions for these.**

### 2.2 Changed — same intent, different shape

| Concern | Change | PRD |
|---|---|---|
| `getCampaign(id)` struct | `reward` field removed; order is now `id,name,host,startTime,endTime,status,tasks[],createdAt,totalParticipants`. Everything else identical. | FR-D3 |
| Lifecycle | `Draft(0)→Open(1)→Ended(2)→Closed(3)→Cancelled(4)`. `endCampaign` now **permissionless** after `endTime`; `cancelCampaign` accepts `Ended` too (zero participants **and** no settlement committed). `openCampaign`/`closeCampaign` stay host-only. | FR-M4, FR-M5, NFR-11/12 |
| Task creation | `addTaskToCampaign` + new `batchAddTasks`; ≤20 tasks. | FR-H3 |
| Participant cap | new `setMaxParticipants(id, cap)` (Draft-only, 0=unlimited). | FR-T6, FR-H2 |
| Pause | `emergencyPause`/`emergencyUnpause` + `paused()` still present. | NFR-16 |

### 2.3 Still-valid — reusable as-is (read helpers)

- `getCampaignCount()`, `getCampaign(id)` (minus `.reward`), `getCampaignTask`,
  `getCampaignsByHost`, `hasParticipated`, `hasCompletedTask`, `isHost` (via `HOST_ROLE`),
  `paused()`, `grantHostRole` (self-serve, FR-H1), `openCampaign`/`endCampaign` call shapes.
- The read-only vs signer dual-contract pattern, the 30s TTL caches, and chainId/address
  cache-keying in `web3-service.ts` are sound and worth keeping.

### 2.4 Missing — new surfaces with no existing code (all PRD-specified)

- **Escrow funding**: `configureERC20Reward`, `fundCampaignERC20`, fee itemization from
  `FeeModule`/`ProtocolFeeCollected` (gross = net `CampaignFundedERC20` + fee) — FR-H4/H5.
- **Merkle settlement**: `setERC20MerkleRoot`, proof-based `claimERC20`/`claimERC20For`,
  `getERC20ClaimableAt`, 24h dispute window + 30-day grace as UI states — FR-C1/C2/C6, FR-M3, NFR-9.
- **NFT path**: deposits on entrypoint; **all** settlement (`setNFTMerkleRoot`/`claimNFT`/
  `withdrawUnclaimed*`) on the **pinned** `NFTSettlementModule` — FR-C3, FR-H4.
- **Tiered path**: `OnChainRewardModule.setRankTiers`/`setScoreTiers`/`claimReward`, leaderboards — FR-C4, FR-M6.
- **Sponsored claims**: `claimERC20For`/`claimNFTFor`/`claimRewardFor` via relayer — FR-C2, BR-R*.
- **Signed attestations**: EIP-712 signer service + submission — BR-V*.
- **Merkle leaf/proof tooling**: `@openzeppelin/merkle-tree`, exact encodings below — BR-M2.
- **SETTLER_ROLE fallback ops**: overdue-campaign detection + admin publish — NFR-11, FR-A5.

---

## 3. Task verification (BR-V*, FR-T1/T3)

**Current:** `POST /api/verify-task` checks Discord/Telegram/Humanity and returns
`{isVerified}`; the client then calls `completeTask` from the user's wallet to record it.
No EIP-712 signing anywhere; no `SIGNER_ROLE` key handling.

**Required (v0.6.0):**
- Backend verifies, reads `getTaskAttestationVersion(campaignId, participant, taskIndex)`,
  signs `TaskAttestation(uint256 campaignId,address participant,uint256 taskIndex,bool completed,uint256 version,uint256 deadline)`
  under domain `EIP712("Web3Campaigns","1")` with `verifyingContract` = entrypoint, target
  version `current+1`, short deadline (≤1h) — BR-V2.
- Submit via `verifyTaskCompletionWithSignature` (or batch, ≤50) — default backend-submitted,
  self-submit fallback — BR-V3.
- `ONCHAIN_HOLD_ERC20/721` stay on `completeTask` with 64-byte `abi.encode(address,uint256)`
  params — the only remaining client-wallet task write (FR-T2, "always costs gas" label).

**Verdict:** `verify-task`'s verifier plumbing (Discord/Telegram/Humanity checks) is
**still-valid** and reusable; the completion-recording model is **removed** and replaced by
the signer service. **Key management (KMS, no plaintext env, audit log) is missing** — BR-V4.

---

## 4. Reward/claim leaf encodings (must match exactly — BR-M2)

- **ERC20 leaf**: `keccak256(bytes.concat(keccak256(abi.encode(account, amount))))`,
  OZ StandardMerkleTree types `["address","uint256"]`.
- **NFT leaf**: `keccak256(bytes.concat(keccak256(abi.encode(account, uint8(standard), token, tokenId, amount))))`,
  types `["address","uint8","address","uint256","uint256"]`; root goes to the **pinned NFT module**.
- Dispute window: `claim*` reverts `RootDisputeWindowActive` until 24h after the root's value
  last changed; identical-root republish does **not** rearm; changed root **does**.

**Verdict:** entirely **missing** — no Merkle code exists in the app today.

---

## 5. Indexer / read layer (BR-I*, P0)

**Current:** `src/lib/graph-service.ts` + `subgraph/` — a The Graph subgraph, but:
- `subgraph.yaml` points at **old address `0xA36842…cDe4`**, startBlock `10907101`
  (new deploy is `0xf0A2…1B3` @ `11314275`).
- Indexed events are the **old schema**: `RewardSet`, `RewardClaimed`,
  `TaskAddedToCampaign(uint256,uint256,uint8,string)`. v0.6.0 emits none of `RewardSet`/
  `RewardClaimed`; it emits `CampaignFundedERC20`, `ProtocolFeeCollected`, `ERC20MerkleRootSet`,
  `ERC20RewardClaimed`, `TaskVerifiedWithSignature`, `RewardModulePinned`, `NFTModulePinned`,
  `MaxParticipantsUpdated`, `UnclaimedERC20Swept`, `FallbackRootPublished`/`FallbackClosed`, etc.
- It indexes **only the entrypoint** — satellite module events
  (`NFTSettlementModule`: `NFTMerkleRootSet`/`NFTRewardClaimed`/`UnclaimedNFTsWithdrawn`;
  `OnChainRewardModule`: tier configs) are not indexed at all, and must be indexed **per
  pinned-module address**, discovered via `*ModulePinned` events (BR-I1).

**Verdict:** subgraph schema, address, startBlock, and event set are **fully stale — rebuild
from v0.6.0 ABIs**. The graph-service *client* pattern (fast path with RPC fallback) is a
**still-valid** shape but every query/entity needs re-deriving.

**Flag:** PRD BR-I1…I4 describe a materialized-state indexer with ≤5s freshness, reorg
`finalized` flags, and SSE push — a larger backend service than the current read-only subgraph.
Whether P0 keeps The Graph or builds a dedicated indexer is an architecture decision worth
confirming before P0 build.

---

## 6. Auth / SIWE (FR-W3/W4)

**Current:** `wallet-auth.ts` / `auth-utils.ts` use a homegrown
`"Sign this message…\nNonce: <timestamp>"` signature with a max-age check; NextAuth + a
`User` table exist. This is **SIWE-*like*, not EIP-4361**, and nonce is a client timestamp
(no server-issued nonce, replay-guardable only by age).

**Required:** proper SIWE (EIP-4361) with server-issued nonce, one wallet ⇄ one session,
off-chain accounts + Humanity status attached to the wallet (FR-W3/W4), CSRF/PKCE (NFR-20).

**Verdict:** **changed** — the message/nonce scheme should move to real SIWE; the NextAuth
session + `User`/`walletAddress` model is a **still-valid** foundation to build on.

---

## 7. Off-chain / DB / OAuth (largely survives)

**Still-valid, reusable:** Prisma models (`CampaignCache`, `CampaignTaskMetadata`,
`SocialVerification`, `PaymentVerification`, `User`), the image/metadata CRUD routes,
UploadThing, Discord/Telegram OAuth + verifiers, Humanity OAuth callback + `humanity-service`,
the AI campaign builder. These hold "what the chain can't" and stay relevant.

**Changed:** the DB `Campaign` mirror must track the new lifecycle/settlement/gating fields
(BR-G2: allocation policy, gating flag, settlement mode, root versions, dispute/grace
timestamps). New entities are **missing**: `Allocation`/`MerkleTree` (versioned),
`SponsoredClaim`, `KeeperJob`, `Notification`, attestation records on `TaskCompletion`.

**Flag — TaskType metadata coupling:** `CampaignTaskMetadata` and `verify-task` assume the
old 6-type set incl. Telegram; they need to track the new 10-type enum and the Telegram
decision (§2.1 flag).

---

## 8. Fully missing services (PRD §3, phased P1–P3)

None of these exist in any form today: **Allocation/Merkle pipeline** (BR-M*), **Signer
service** (BR-V*), **Relayer** (BR-R*), **Keeper** for permissionless `endCampaign` (BR-K*),
**Notification service** (BR-N*), **Admin console** (FR-A*, incl. SETTLER_ROLE fallback ops
per NFR-11). These are net-new build, gated behind their PRD phases.

---

## 9. PRD open questions that block work (surfacing, per instructions — not deciding)

Implementation should use the smallest reasonable default and flag it. Relevant here:
- **Q2 protocol fee**: FeeModule not deployed (fees off) — FR-H5 itemization can show
  "0 fee" until a rate is set. Default: fees off, itemize gross=net.
- **Q3 allocation-policy set** (equal-split / points-proportional / per-task-fixed / CSV):
  blocks the P1 wizard + pipeline. Default: equal-split among qualifiers, policy shown pre-Open.
- **Q6 relayer budgets**, **Q7 email scope**, **Q9 discovery curation** — block P2/P0 respectively.
- **Non-§6 flag (mine): Telegram task type** has no on-chain representation (§2.1). Needs a call.

---

## 10. Recommended Phase-2 sequencing (for review)

1. **Foundation swap (unblocks everything):** drop in v0.6.0 ABIs (+ 3 module ABIs), extend
   `config.ts` to a module address book, update `.env` to the new addresses, fix the
   `Campaign` struct mapping (remove `.reward`), fix the `TaskType` enum/union. Typecheck gate.
2. **P0:** rebuild the subgraph/indexer against v0.6.0 (new address, block, full event set incl.
   satellites via pin events); real SIWE; read-only discovery + campaign detail from indexed data.
3. **P1:** ERC20 Merkle loop — creation wizard (Draft→configure→fund→open), signer service +
   attestation submission, allocation/Merkle pipeline + host review, self-claim, keeper.
4. **P2/P3:** gasless relayer + Humanity gating; tiered + NFT settlement; analytics; admin console.

Each step should land behind `npm run typecheck` (the repo's correctness gate; no test suite).
