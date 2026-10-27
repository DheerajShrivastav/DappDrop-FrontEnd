# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run dev          # Start dev server on :3000 with Turbopack
npm run build        # prisma generate + next build
npm run lint         # ESLint via next lint
npm run typecheck    # tsc --noEmit
npm run test:unit    # unit tests: src/**/*.test.ts via tsx --test (node:test)

npx prisma generate  # Re-generate Prisma client after schema changes
npx prisma migrate dev --name <name>  # Create and apply a new migration
npx prisma studio    # Open DB browser
```

Type-checking (`npm run typecheck`) is the primary correctness gate; `npm run test:unit` covers the pure helpers (status model, indexer schema guard, hidden-campaigns filter).

---

## Architecture

DappDrop is a **Next.js 15 App Router** project. The core split is:

- **`src/app/(marketing)/`** — SSR-only public pages (landing, about, changelog). No wallet or blockchain code.
- **`src/app/(app)/`** — Client-side authenticated app. All blockchain interaction happens here.
- **`src/app/api/`** — Next.js API routes that run server-side. Handles social verification, Humanity Protocol, campaign metadata CRUD, image uploads, and batch off-chain metadata fetches (`/api/campaigns/metadata-batch`).

### Blockchain interaction layer

All read/write calls to the smart contract go through **`src/lib/web3-service.ts`** (≈2600 lines). Never import `ethers` or instantiate a `Contract` directly in components — always add new contract interactions here.

The file maintains two contract instances:
- `contract` — signer-backed (requires connected wallet, used for writes)
- `readOnlyContract` — provider-backed with `NEXT_PUBLIC_RPC_URL` (used for reads, no wallet needed)

**`src/lib/graph-service.ts`** is a GraphQL client (`graphql-request`) that sits in front of the most expensive RPC paths. When `NEXT_PUBLIC_GRAPH_API_URL` is set, these four functions query the deployed subgraph instead of making N+1 RPC calls: `getGraphCampaigns`, `getGraphCampaignsByHost`, `getGraphParticipantAddresses`, `getGraphParticipants`. Each returns `null` when the env var is unset, and the callers in `web3-service.ts` fall back to direct RPC in that case.

Key read functions and their cost:
- `getAllCampaigns()` — **Graph fast path** (single query) when `NEXT_PUBLIC_GRAPH_API_URL` is set; falls back to `getCampaignCount()` + N×`getCampaign(i)` RPC loop.
- `getCampaignsByHostAddress()` — **Graph fast path**; falls back to filtering all campaigns by host address via RPC.
- `getCampaignByIdWithMetadata()` — single `getCampaign()` + DB fetch for off-chain metadata (no Graph path — single-campaign fetch is already O(1)).
- `getCampaignParticipantAddresses()` — **Graph fast path** inside the 30s TTL cache; falls back to `ParticipantTaskCompleted` event log scanning.
- `getCampaignParticipants()` — **Graph fast path** inside the 30s TTL cache; falls back to per-participant concurrent calls (limit 3).

`hasParticipated`, `getUserTaskCompletionStatus`, and `isHost` intentionally stay on direct RPC — they gate the connected user's own actions and must not have subgraph indexing lag.

In-memory caches (30s TTL + in-flight deduplication) exist for: `hasParticipated`, `isHost`, `isPaused`, participant addresses, and participant details. Cache keys include `chainId` and `contractAddress` to prevent cross-network leakage.

### Database role (Prisma + PostgreSQL/Neon)

The DB is **not** a blockchain mirror — it only holds what the chain cannot:

| Model | Purpose |
|---|---|
| `CampaignCache` | Off-chain metadata: `imageUrl`, `shortDescription`, `longDescription`, `tags`, `rewardName`. Written on campaign creation. |
| `CampaignTaskMetadata` | Per-task extras: Discord server ID/invite, Telegram chat ID, Humanity preset, payment metadata. Keyed by `(campaignId, taskIndex)`. |
| `SocialVerification` | Proof records for Discord/Telegram/Twitter verifications. |
| `PaymentVerification` | On-chain tx hash records for `ONCHAIN_TX` tasks. |
| `User` | NextAuth user + `walletAddress`, `humanityVerified`, `discordId`. |

### Context providers (load order matters)

```
Web3Provider (RainbowKit + Wagmi + React Query)
  └─ HumanityProvider (@humanity-org/react-sdk)
       └─ WalletProvider (custom — derives role, address, isConnected)
```

`WalletProvider` calls `isHost(address)` from `web3-service.ts` on wallet connect to set `role: 'host' | 'participant' | null`. Role gates which UI surfaces (host controls, analytics) are shown.

### Task verification flow

Since contracts PR #24, `completeTask()` on-chain self-verifies only `ONCHAIN_HOLD_ERC20` / `ONCHAIN_HOLD_ERC721` (a balance check in the transaction); every other type reverts `NotSelfVerifiable`. Those types go through `POST /api/verify-task` (and `GET /api/verify-humanity` for `HUMANITY_VERIFICATION`), where the backend checks the task and the `SIGNER_ROLE` key signs an EIP-712 attestation that is submitted via `verifyTaskCompletionWithSignature` (or self-submitted from the wallet with `submitAttestationFromWallet` if the backend couldn't). The `completeTask()` wrapper in `web3-service.ts` refuses non-hold types and uses `staticCall` as a pre-flight before sending.

### Contract errors

The contracts revert with custom errors only (no revert strings since PR #26). Decode them with `src/lib/contract-errors.ts` (`describeContractError` / `contractErrorMessage` / `contractErrorName`), or `mapContractRevertToMessage` from `web3-service.ts`. Never match revert text with `.includes(...)`.

### Campaign lifecycle

On-chain states: `Draft (0) → Open (1) → Ended (2)`. "Closed (3)" is a separate terminal state.

A campaign with `status === 'Open'` but `new Date() > campaign.endDate` is **expired but not closed** — the creator forgot to call `endCampaign()`. The UI detects this via `isTimeExpiredNotClosed` computed in `src/app/(app)/campaign/[id]/page.tsx` and blocks all task interactions, showing a warning banner.

### Smart contract

ABI lives at `src/lib/abi/Web3Campaigns.json`. Contract address and chain are configured via:
- `NEXT_PUBLIC_CAMPAIGN_FACTORY_CONTRACT`
- `NEXT_PUBLIC_CHAIN_ID` (defaults to `11155111` = Sepolia)
- `NEXT_PUBLIC_RPC_URL` / `NEXT_PUBLIC_SEPOLIA_RPC_URL`

All config is centralized in `src/app/config.ts`.

### Key env vars

| Variable | What it gates |
|---|---|
| `DATABASE_URL` | All Prisma DB access |
| `NEXT_PUBLIC_CAMPAIGN_FACTORY_CONTRACT` | All blockchain reads/writes |
| `NEXT_PUBLIC_RPC_URL` | Read-only contract calls (no wallet needed) |
| `GEMINI_API_KEY` | AI campaign builder in create flow |
| `DISCORD_BOT_TOKEN` | Discord membership verification in `/api/verify-task` |
| `TELEGRAM_BOT_TOKEN` | Telegram membership verification |
| `NEXT_PUBLIC_HUMANITY_CLIENT_ID` | Humanity Protocol OAuth |
| `UPLOADTHING_SECRET` / `UPLOADTHING_TOKEN` | Campaign image uploads |
| `NEXT_PUBLIC_GRAPH_API_URL` | The Graph subgraph endpoint; enables fast-path list queries (optional — falls back to RPC) |

### UI component conventions

- UI primitives are **shadcn/ui** (`src/components/ui/`) — Radix UI + Tailwind. Don't install new component libraries; extend these.
- Animations use **Framer Motion** `motion.*` wrappers. The standard pattern is `initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}`.
- Heavy dialogs/modals are **lazy-loaded** with `next/dynamic` + `{ ssr: false }` in page files to keep initial bundle small.
- Toast notifications use `useToast` from `src/hooks/use-toast.ts` — always pass `variant: 'destructive'` for errors.
