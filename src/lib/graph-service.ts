/**
 * graph-service.ts
 *
 * GraphQL client for The Graph subgraph. Replaces the expensive N+1 RPC calls
 * in web3-service.ts for read-heavy list and analytics queries:
 *   - getAllCampaigns()          → getGraphCampaigns()
 *   - getCampaignsByHostAddress() → getGraphCampaignsByHost()
 *   - getCampaignParticipantAddresses() → getGraphParticipantAddresses()
 *   - getCampaignParticipants()  → getGraphParticipants()
 *
 * Write operations and per-user real-time checks (hasParticipated,
 * getUserTaskCompletionStatus, isHost) remain in web3-service.ts because
 * they need a signer or require zero indexing lag.
 */

import { GraphQLClient, gql } from 'graphql-request'
import config from '@/app/config'
import type { Campaign, ParticipantData } from './types'

// ---------------------------------------------------------------------------
// Client setup
// ---------------------------------------------------------------------------

function getClient(): GraphQLClient | null {
  if (!config.graphApiUrl) return null
  return new GraphQLClient(config.graphApiUrl)
}

// ---------------------------------------------------------------------------
// Type maps (must stay in sync with Solidity enums in Web3Campaigns.sol)
// ---------------------------------------------------------------------------

const STATUS_MAP = ['Draft', 'Open', 'Ended', 'Closed'] as const
const REWARD_TYPE_MAP = ['ERC20', 'ERC721', 'None'] as const
const TASK_TYPE_MAP = [
  'SOCIAL_FOLLOW',          // 0
  'JOIN_DISCORD',           // 1
  'JOIN_TELEGRAM',          // 2
  'RETWEET',                // 3
  'ONCHAIN_TX',             // 4
  'HUMANITY_VERIFICATION',  // 5
] as const

// ---------------------------------------------------------------------------
// GraphQL fragments & queries
// ---------------------------------------------------------------------------

// The Graph enforces a hard max of 1000 for `first` on any field. Campaign
// task lists are inherently small (a handful of tasks per campaign), so 1000
// effectively removes truncation risk there without needing pagination.
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
    rewardType
    rewardTokenAddress
    rewardAmountOrTokenId
    tasks(orderBy: taskId, orderDirection: asc, first: ${MAX_PAGE_SIZE}) {
      taskId
      taskType
      description
    }
  }
`

// Campaigns and participations, unlike tasks, can realistically exceed 1000
// rows over the platform's lifetime, so these are paginated with skip below
// rather than relying on a single first:1000 request.
const GET_ALL_CAMPAIGNS = gql`
  ${CAMPAIGN_FIELDS}
  query GetAllCampaigns($first: Int!, $skip: Int!) {
    campaigns(
      where: { status_in: [1, 2] }
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
  query GetParticipantAddresses($campaignId: ID!, $first: Int!, $skip: Int!) {
    participations(
      where: { campaign: $campaignId }
      first: $first
      skip: $skip
    ) {
      participant
    }
  }
`

const GET_PARTICIPANTS = gql`
  query GetParticipants($campaignId: ID!, $first: Int!, $skip: Int!) {
    participations(
      where: { campaign: $campaignId }
      first: $first
      skip: $skip
    ) {
      participant
      hasClaimedReward
      tasksCompleted
    }
  }
`

/**
 * Runs `fetchPage(skip)` repeatedly, accumulating results, until a page comes
 * back smaller than MAX_PAGE_SIZE (meaning there's nothing left to fetch).
 * Used for entity lists that can plausibly exceed a single page over the
 * platform's lifetime (campaigns, participations).
 */
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
// Graph campaign data shape (returned by subgraph)
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
  rewardType: number | null
  rewardTokenAddress: string | null
  rewardAmountOrTokenId: string | null
  tasks: GraphTask[]
}

interface GraphParticipation {
  participant: string
  hasClaimedReward: boolean
  tasksCompleted: number
}

// ---------------------------------------------------------------------------
// Off-chain metadata batch fetch
// ---------------------------------------------------------------------------

interface OffChainMeta {
  imageUrl?: string
  shortDescription?: string
  longDescription?: string
  rewardName?: string
}

async function fetchOffChainMetadataBatch(
  campaignIds: string[],
): Promise<Record<string, OffChainMeta>> {
  if (campaignIds.length === 0) return {}
  if (typeof window === 'undefined') {
    console.warn('[graph-service] fetchOffChainMetadataBatch called server-side; off-chain metadata will be empty')
    return {}
  }

  try {
    const params = new URLSearchParams()
    campaignIds.forEach((id) => params.append('ids', id))
    const res = await fetch(`/api/campaigns/metadata-batch?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      return data.metadata ?? {}
    }
  } catch {
    // Fall through to individual fetches
  }

  // Fallback: parallel individual fetches (original behaviour)
  const entries = await Promise.all(
    campaignIds.map(async (id) => {
      try {
        const res = await fetch(`/api/campaigns/${id}/image`)
        if (res.ok) {
          const d = await res.json()
          return [id, d as OffChainMeta] as const
        }
      } catch {
        /* ignore */
      }
      return [id, {}] as const
    }),
  )
  return Object.fromEntries(entries)
}

// ---------------------------------------------------------------------------
// Mapper: Graph campaign → Campaign (frontend type)
// ---------------------------------------------------------------------------

function mapGraphCampaign(
  gc: GraphCampaign,
  meta: OffChainMeta,
): Campaign {
  const rewardTypeIndex = gc.rewardType ?? 2
  const rewardName =
    meta.rewardName ??
    (rewardTypeIndex === 2 ? 'A special off-chain reward' : `Reward for ${gc.name}`)

  return {
    id: gc.id,
    title: gc.name,
    description: meta.shortDescription ?? `A campaign hosted by ${gc.host}`,
    longDescription:
      meta.longDescription ??
      `A campaign hosted by ${gc.host} with the name ${gc.name}.`,
    startDate: new Date(Number(gc.startTime) * 1000),
    endDate: new Date(Number(gc.endTime) * 1000),
    status: (STATUS_MAP[gc.status] ?? (() => { console.warn(`[graph-service] Unknown campaign status index: ${gc.status}`); return 'Draft' })()) as Campaign['status'],
    participants: gc.totalParticipants,
    host: gc.host,
    tasks: gc.tasks.map((t) => ({
      id: t.taskId.toString(),
      type: (TASK_TYPE_MAP[t.taskType] ?? 'SOCIAL_FOLLOW') as Campaign['tasks'][number]['type'],
      description: t.description,
      verificationData: '',
    })),
    reward: {
      type: REWARD_TYPE_MAP[rewardTypeIndex] as Campaign['reward']['type'],
      tokenAddress: gc.rewardTokenAddress ?? '0x0000000000000000000000000000000000000000',
      amount: gc.rewardAmountOrTokenId ?? '0',
      name: rewardName,
    },
    imageUrl: meta.imageUrl ?? 'https://placehold.co/600x400',
    'data-ai-hint': 'blockchain technology',
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Replaces getAllCampaigns() — single GraphQL query instead of N+1 RPC calls.
 * Returns null when The Graph is not configured so callers can fall back to RPC.
 */
export async function getGraphCampaigns(): Promise<Campaign[] | null> {
  const client = getClient()
  if (!client) return null

  try {
    const campaigns = await fetchAllPages<GraphCampaign>((first, skip) =>
      client
        .request<{ campaigns: GraphCampaign[] }>(GET_ALL_CAMPAIGNS, {
          first,
          skip,
        })
        .then((data) => data.campaigns),
    )

    const meta = await fetchOffChainMetadataBatch(campaigns.map((c) => c.id))
    return campaigns.map((c) => mapGraphCampaign(c, meta[c.id] ?? {}))
  } catch (err) {
    console.error('[graph-service] getGraphCampaigns failed:', err)
    return null
  }
}

/**
 * Replaces getCampaignsByHostAddress() — single GraphQL query instead of N+1 RPC calls.
 * Returns null when The Graph is not configured.
 */
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
        .then((data) => data.campaigns),
    )

    const meta = await fetchOffChainMetadataBatch(campaigns.map((c) => c.id))
    return campaigns.map((c) => mapGraphCampaign(c, meta[c.id] ?? {}))
  } catch (err) {
    console.error('[graph-service] getGraphCampaignsByHost failed:', err)
    return null
  }
}

/**
 * Replaces getCampaignParticipantAddresses() — single GraphQL query instead of
 * event log scanning with chunked block range queries.
 * Returns null when The Graph is not configured.
 */
export async function getGraphParticipantAddresses(
  campaignId: string,
): Promise<string[] | null> {
  const client = getClient()
  if (!client) return null

  try {
    const participations = await fetchAllPages<{ participant: string }>(
      (first, skip) =>
        client
          .request<{
            participations: { participant: string }[]
          }>(GET_PARTICIPANT_ADDRESSES, { campaignId, first, skip })
          .then((data) => data.participations),
    )

    return participations.map((p) => p.participant.toLowerCase())
  } catch (err) {
    console.error('[graph-service] getGraphParticipantAddresses failed:', err)
    return null
  }
}

/**
 * Replaces getCampaignParticipants() — single GraphQL query instead of
 * M×T contract calls (one per participant per task).
 * Returns null when The Graph is not configured.
 */
export async function getGraphParticipants(
  campaignId: string,
): Promise<ParticipantData[] | null> {
  const client = getClient()
  if (!client) return null

  try {
    const participations = await fetchAllPages<GraphParticipation>(
      (first, skip) =>
        client
          .request<{ participations: GraphParticipation[] }>(
            GET_PARTICIPANTS,
            { campaignId, first, skip },
          )
          .then((data) => data.participations),
    )

    return participations.map((p) => ({
      address: p.participant.toLowerCase(),
      tasksCompleted: p.tasksCompleted,
      claimed: p.hasClaimedReward,
    }))
  } catch (err) {
    console.error('[graph-service] getGraphParticipants failed:', err)
    return null
  }
}

/** Returns true when a Graph API URL is configured and queries can be made. */
export function isGraphConfigured(): boolean {
  return Boolean(config.graphApiUrl)
}
