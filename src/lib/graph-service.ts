/**
 * graph-service.ts — GraphQL client for the v0.6.0 The Graph subgraph (Decision 3).
 *
 * Fast path for read-heavy list/discovery queries, replacing N+1 RPC calls in
 * web3-service.ts. Returns null when NEXT_PUBLIC_GRAPH_API_URL is unset so callers fall
 * back to direct RPC against the correct v0.6.0 contract.
 *
 * BR-I4: value-bearing decisions (claim eligibility, allocation totals, sweep availability)
 * MUST re-verify against a direct RPC read at execution time — never trust this cache for
 * money. These functions serve discovery/display/scheduling only.
 *
 * Write ops and per-user gating checks (hasParticipated, getUserTaskCompletionStatus,
 * isHost) stay on direct RPC in web3-service.ts (zero indexing lag for the user's own
 * actions).
 */

import { GraphQLClient, gql } from 'graphql-request'
import config from '@/app/config'
import type {
  Campaign,
  CampaignSettlement,
  ParticipantData,
  SettlementMode,
} from './types'
import { fromOnChainTaskType } from './task-types'

// ---------------------------------------------------------------------------
// Client setup
// ---------------------------------------------------------------------------

function getClient(): GraphQLClient | null {
  if (!config.graphApiUrl) return null
  return new GraphQLClient(config.graphApiUrl)
}

/** Returns true when a Graph API URL is configured and queries can be made. */
export function isGraphConfigured(): boolean {
  return Boolean(config.graphApiUrl)
}

// v0.6.0 lifecycle: Draft, Open, Ended, Closed, Cancelled.
const STATUS_MAP = ['Draft', 'Open', 'Ended', 'Closed', 'Cancelled'] as const

// The Graph caps `first` at 1000; task lists are tiny, so 1000 removes truncation risk.
const MAX_PAGE_SIZE = 1000

const CAMPAIGN_FIELDS = gql`
  fragment CampaignFields on Campaign {
    id
    host
    name
    startTime
    endTime
    status
    totalParticipants
    maxParticipants
    createdAt
    closedAt
    cancelledAt
    refundedERC20
    settlementMode
    erc20Token
    erc20EscrowedNet
    erc20FeePaid
    erc20MerkleRoot
    erc20RootPublishedAt
    erc20Swept
    erc20SweptAt
    nftModule
    nftMerkleRoot
    nftRootPublishedAt
    rewardModule
    tierCount
    fallbackRootPublished
    fallbackClosed
    offChainRewardDescription
    tasks(orderBy: taskId, orderDirection: asc, first: ${MAX_PAGE_SIZE}) {
      taskId
      taskType
      description
    }
  }
`

// Discovery lists Open (1) and Ended (2) campaigns; the UI filters/sorts client-side.
const GET_ALL_CAMPAIGNS = gql`
  ${CAMPAIGN_FIELDS}
  query GetAllCampaigns($first: Int!, $skip: Int!) {
    campaigns(
      where: { status_in: [1, 2, 3] }
      orderBy: createdAt
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      ...CampaignFields
    }
  }
`

const GET_CAMPAIGNS_BY_HOST = gql`
  ${CAMPAIGN_FIELDS}
  query GetCampaignsByHost($host: Bytes!, $first: Int!, $skip: Int!) {
    campaigns(
      where: { host: $host }
      orderBy: createdAt
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      ...CampaignFields
    }
  }
`

const GET_PARTICIPANT_ADDRESSES = gql`
  query GetParticipantAddresses($campaignId: String!, $first: Int!, $skip: Int!) {
    participations(where: { campaign: $campaignId }, first: $first, skip: $skip) {
      participant
    }
  }
`

const GET_PARTICIPANTS = gql`
  query GetParticipants($campaignId: String!, $first: Int!, $skip: Int!) {
    participations(where: { campaign: $campaignId }, first: $first, skip: $skip) {
      participant
      tasksCompleted
    }
    claims(where: { campaign: $campaignId }, first: $first, skip: $skip) {
      account
    }
  }
`

async function fetchAllPages<T>(
  fetchPage: (first: number, skip: number) => Promise<T[]>,
): Promise<T[]> {
  const results: T[] = []
  let skip = 0
  while (true) {
    const page = await fetchPage(MAX_PAGE_SIZE, skip)
    results.push(...page)
    if (page.length < MAX_PAGE_SIZE) break
    skip += MAX_PAGE_SIZE
  }
  return results
}

// ---------------------------------------------------------------------------
// Graph response shapes
// ---------------------------------------------------------------------------

interface GraphTask {
  taskId: string
  taskType: number
  description: string
}

interface GraphCampaign {
  id: string
  host: string
  name: string
  startTime: string
  endTime: string
  status: number
  totalParticipants: number
  maxParticipants: string
  createdAt: string
  closedAt: string | null
  cancelledAt: string | null
  refundedERC20: string | null
  settlementMode: SettlementMode
  erc20Token: string | null
  erc20EscrowedNet: string
  erc20FeePaid: string
  erc20MerkleRoot: string | null
  erc20RootPublishedAt: string | null
  erc20Swept: boolean
  erc20SweptAt: string | null
  nftModule: string | null
  nftMerkleRoot: string | null
  nftRootPublishedAt: string | null
  rewardModule: string | null
  tierCount: number | null
  fallbackRootPublished: boolean
  fallbackClosed: boolean
  offChainRewardDescription: string | null
  tasks: GraphTask[]
}

interface OffChainMeta {
  imageUrl?: string
  shortDescription?: string
  longDescription?: string
  rewardName?: string
  rewardType?: 'ERC20' | 'ERC721' | 'None'
  hiddenFromDiscovery?: boolean
}

// ---------------------------------------------------------------------------
// Off-chain metadata batch fetch (Postgres, via the app API)
// ---------------------------------------------------------------------------

async function fetchOffChainMetadataBatch(
  campaignIds: string[],
): Promise<Record<string, OffChainMeta>> {
  if (campaignIds.length === 0) return {}
  if (typeof window === 'undefined') return {}
  try {
    const params = new URLSearchParams()
    campaignIds.forEach((id) => params.append('ids', id))
    const res = await fetch(`/api/campaigns/metadata-batch?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      return data.metadata ?? {}
    }
  } catch {
    /* fall through to individual fetches */
  }
  const entries = await Promise.all(
    campaignIds.map(async (id) => {
      try {
        const res = await fetch(`/api/campaigns/${id}/image`)
        if (res.ok) return [id, (await res.json()) as OffChainMeta] as const
      } catch {
        /* ignore */
      }
      return [id, {} as OffChainMeta] as const
    }),
  )
  return Object.fromEntries(entries)
}

// ---------------------------------------------------------------------------
// Mapper: Graph campaign → Campaign (frontend type)
// ---------------------------------------------------------------------------

const tsToDate = (v: string | null | undefined): Date | undefined =>
  v == null ? undefined : new Date(Number(v) * 1000)

// Reward type shown in discovery, derived from the committed settlement mode. Real figures
// (token/amount) come from indexed escrow; a campaign that hasn't committed a mode yet
// renders as "None" (graceful degradation — foundation-swap review item (a)).
function rewardTypeFromMode(
  mode: SettlementMode,
): 'ERC20' | 'ERC721' | 'None' {
  if (mode === 'NFT') return 'ERC721'
  if (mode === 'UNSET') return 'None'
  return 'ERC20'
}

function mapGraphCampaign(gc: GraphCampaign, meta: OffChainMeta): Campaign {
  const settlement: CampaignSettlement = {
    mode: gc.settlementMode,
    maxParticipants: Number(gc.maxParticipants),
    closedAt: tsToDate(gc.closedAt),
    cancelledAt: tsToDate(gc.cancelledAt),
    refundedERC20: gc.refundedERC20 ?? undefined,
    erc20Token: gc.erc20Token ?? undefined,
    erc20EscrowedNet: gc.erc20EscrowedNet,
    erc20FeePaid: gc.erc20FeePaid,
    erc20MerkleRoot: gc.erc20MerkleRoot,
    erc20RootPublishedAt: tsToDate(gc.erc20RootPublishedAt),
    erc20Swept: gc.erc20Swept,
    erc20SweptAt: tsToDate(gc.erc20SweptAt),
    nftModule: gc.nftModule ?? undefined,
    nftMerkleRoot: gc.nftMerkleRoot,
    nftRootPublishedAt: tsToDate(gc.nftRootPublishedAt),
    rewardModule: gc.rewardModule ?? undefined,
    tierCount: gc.tierCount ?? undefined,
    fallbackRootPublished: gc.fallbackRootPublished,
    fallbackClosed: gc.fallbackClosed,
  }

  const rewardType = meta.rewardType ?? rewardTypeFromMode(gc.settlementMode)
  const rewardName =
    meta.rewardName ??
    (rewardType === 'None' ? 'Reward to be announced' : `Reward for ${gc.name}`)

  return {
    id: gc.id,
    title: gc.name,
    description: meta.shortDescription ?? `A campaign hosted by ${gc.host}`,
    longDescription:
      meta.longDescription ??
      `A campaign hosted by ${gc.host} with the name ${gc.name}.`,
    startDate: new Date(Number(gc.startTime) * 1000),
    endDate: new Date(Number(gc.endTime) * 1000),
    status: (STATUS_MAP[gc.status] ?? 'Draft') as Campaign['status'],
    participants: gc.totalParticipants,
    host: gc.host,
    tasks: gc.tasks.map((t) => ({
      // Raw on-chain enum → app task type; DISCORD_JOIN's Telegram case needs
      // metadata.platform, joined later by the caller (Decision 2). Default: Discord.
      id: t.taskId.toString(),
      type: fromOnChainTaskType(t.taskType),
      description: t.description,
      verificationData: '',
    })),
    reward: {
      type: rewardType,
      tokenAddress: gc.erc20Token ?? '',
      amount: gc.erc20EscrowedNet !== '0' ? gc.erc20EscrowedNet : undefined,
      name: rewardName,
    },
    settlement,
    imageUrl: meta.imageUrl ?? 'https://placehold.co/600x400',
    'data-ai-hint': 'blockchain technology',
  }
}

// ---------------------------------------------------------------------------
// Public API (null => Graph not configured; caller falls back to RPC)
// ---------------------------------------------------------------------------

export async function getGraphCampaigns(): Promise<Campaign[] | null> {
  const client = getClient()
  if (!client) return null
  try {
    const campaigns = await fetchAllPages<GraphCampaign>((first, skip) =>
      client
        .request<{ campaigns: GraphCampaign[] }>(GET_ALL_CAMPAIGNS, { first, skip })
        .then((d) => d.campaigns),
    )
    const meta = await fetchOffChainMetadataBatch(campaigns.map((c) => c.id))
    // P3 CP4: public discovery excludes campaigns an admin has hidden (off-chain only — the
    // host's own dashboard uses getGraphCampaignsByHost, which does NOT filter, so a host can
    // still see and manage their own hidden campaign).
    return campaigns
      .filter((c) => !meta[c.id]?.hiddenFromDiscovery)
      .map((c) => mapGraphCampaign(c, meta[c.id] ?? {}))
  } catch (err) {
    console.error('[graph-service] getGraphCampaigns failed:', err)
    return null
  }
}

export async function getGraphCampaignsByHost(
  hostAddress: string,
): Promise<Campaign[] | null> {
  const client = getClient()
  if (!client) return null
  try {
    const host = hostAddress.toLowerCase()
    const campaigns = await fetchAllPages<GraphCampaign>((first, skip) =>
      client
        .request<{ campaigns: GraphCampaign[] }>(GET_CAMPAIGNS_BY_HOST, {
          host,
          first,
          skip,
        })
        .then((d) => d.campaigns),
    )
    const meta = await fetchOffChainMetadataBatch(campaigns.map((c) => c.id))
    return campaigns.map((c) => mapGraphCampaign(c, meta[c.id] ?? {}))
  } catch (err) {
    console.error('[graph-service] getGraphCampaignsByHost failed:', err)
    return null
  }
}

export async function getGraphParticipantAddresses(
  campaignId: string,
): Promise<string[] | null> {
  const client = getClient()
  if (!client) return null
  try {
    const participations = await fetchAllPages<{ participant: string }>((first, skip) =>
      client
        .request<{ participations: { participant: string }[] }>(
          GET_PARTICIPANT_ADDRESSES,
          { campaignId, first, skip },
        )
        .then((d) => d.participations),
    )
    return participations.map((p) => p.participant.toLowerCase())
  } catch (err) {
    console.error('[graph-service] getGraphParticipantAddresses failed:', err)
    return null
  }
}

export async function getGraphParticipants(
  campaignId: string,
): Promise<ParticipantData[] | null> {
  const client = getClient()
  if (!client) return null
  try {
    // Single query returns participations + the set of accounts that have claimed.
    const data = await client.request<{
      participations: { participant: string; tasksCompleted: number }[]
      claims: { account: string }[]
    }>(GET_PARTICIPANTS, { campaignId, first: MAX_PAGE_SIZE, skip: 0 })

    const claimed = new Set(data.claims.map((c) => c.account.toLowerCase()))
    return data.participations.map((p) => ({
      address: p.participant.toLowerCase(),
      tasksCompleted: p.tasksCompleted,
      claimed: claimed.has(p.participant.toLowerCase()),
    }))
  } catch (err) {
    console.error('[graph-service] getGraphParticipants failed:', err)
    return null
  }
}
