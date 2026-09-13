export type { HumanityPreset } from './humanity-presets'

// TaskType is defined once in the canonical taxonomy (docs/DECISIONS_v0.6.0.md Decision 2)
// and re-exported here so existing `import { TaskType } from '@/lib/types'` sites keep working.
import type { TaskType } from './task-types'
export type { TaskType }

export type Task = {
  id: string
  type: TaskType
  description: string
  verificationData?: string
  discordInviteLink?: string // For JOIN_DISCORD tasks: the actual invite link for participants to join
  telegramInviteLink?: string // For JOIN_TELEGRAM tasks: the actual invite link for participants to join
  metadata?: {
    paymentRequired?: boolean
    paymentRecipient?: string
    chainId?: number
    network?: string
    tokenAddress?: string | null
    tokenSymbol?: string
    amount?: string
    amountDisplay?: string
    /** For HUMANITY_VERIFICATION tasks: which preset(s) to verify against */
    humanityPreset?: string | string[]
  }
}

export type UserTask = {
  taskId: string
  completed: boolean
  isCompleting?: boolean
}

// v0.6.0 NOTE: the on-chain `Campaign` struct NO LONGER carries reward data (the `reward`
// tuple was removed when rewards moved to escrow + post-end settlement). This shape is now
// populated from OFF-CHAIN metadata (rewardName/rewardType persisted at creation).
// TODO(P1): source authoritative reward figures (token, escrowed/net amount, settlement
// mode) from the settlement views — getERC20Settlement(id), NFT module escrow, or the
// tiered module — and extend `type` to distinguish MERKLE_ERC20 / RANK_TIERED /
// SCORE_TIERED / NFT per docs/REWARD_SYSTEM.md.
export type Reward = {
  type: 'ERC20' | 'ERC721' | 'None'
  tokenAddress: string
  amount?: string
  name: string
}

// v0.6.0 settlement mode a campaign has committed to (from indexed events). Mirrors the
// subgraph SettlementMode enum; UNSET until the first mode-committing action.
export type SettlementMode =
  | 'UNSET'
  | 'MERKLE_ERC20'
  | 'RANK_TIERED'
  | 'SCORE_TIERED'
  | 'NFT'

// Indexed on-chain settlement/lifecycle facts, sourced from the subgraph (or, partially,
// from direct RPC on the fallback path). All optional so a campaign built from a thin
// source degrades gracefully (the lifecycle helper + UI treat missing fields as "unknown").
// NOTE (BR-I4): none of these are authoritative for a value-bearing action — claim/settle
// paths re-verify against a direct RPC read at execution time (that lands in P1).
export type CampaignSettlement = {
  mode: SettlementMode
  maxParticipants?: number // 0 = unlimited
  closedAt?: Date
  cancelledAt?: Date
  refundedERC20?: string
  // ERC20 escrow (net of protocol fee) + Merkle settlement
  erc20Token?: string
  erc20EscrowedNet?: string
  erc20FeePaid?: string
  erc20MerkleRoot?: string | null
  erc20RootPublishedAt?: Date // dispute-window anchor (claims open at +24h)
  erc20Swept?: boolean
  erc20SweptAt?: Date
  // NFT Merkle settlement (pinned module)
  nftModule?: string
  nftMerkleRoot?: string | null
  nftRootPublishedAt?: Date
  // On-chain tiered settlement (pinned module)
  rewardModule?: string
  tierCount?: number
  // SETTLER_ROLE fallback (NFR-11)
  fallbackRootPublished?: boolean
  fallbackClosed?: boolean
}

export type Campaign = {
  id: string
  title: string
  description: string // This is the short description
  longDescription: string
  startDate: Date
  endDate: Date
  // v0.6.0 lifecycle: Draft→Open→Ended→Closed, plus terminal Cancelled (FR-M5, NFR-12).
  status: 'Draft' | 'Open' | 'Ended' | 'Closed' | 'Cancelled'
  participants: number
  host: string
  tasks: Task[]
  reward: Reward
  // v0.6.0 indexed settlement/lifecycle facts (optional; drives the NFR-9 state ladder).
  settlement?: CampaignSettlement
  imageUrl: string
  'data-ai-hint'?: string
  lastSyncedAt?: Date
  verificationStatus?: 'pending' | 'verified' | 'rejected'
}

export interface ParticipantData {
  address: string
  tasksCompleted: number
  claimed: boolean
}

// Database models (matching Prisma schema)
export interface User {
  id: string
  walletAddress: string
  username?: string | null
  email?: string | null
  notificationSettings?: any
  preferences?: any
  humanityVerified?: boolean
  lastHumanityCheck?: Date | null
  createdAt: Date
}

export interface CampaignCache {
  id: string
  campaignId: number // On-chain campaign ID
  contractAddress: string
  title: string
  description: string
  hostAddress: string
  isActive: boolean
  imageUrl?: string | null
  tags: string[]
  featuredUntil?: Date | null
  lastSyncedAt: Date
}

export interface SocialVerification {
  id: string
  userAddress: string
  campaignId: number
  taskIndex: number
  platform: string
  proofData: any
  verifiedAt?: Date | null
  isValid: boolean
}

export interface Analytics {
  id: string
  eventType: string
  userAddress?: string | null
  campaignId?: number | null
  data: any
  timestamp: Date
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// API request types
export interface AuthRequest {
  walletAddress: string
  signature: string
  message: string
}

export interface TaskVerificationRequest {
  userAddress: string
  campaignId: number
  taskIndex: number
  platform: string
  socialHandle: string
}

export interface CampaignSyncRequest {
  campaignId?: string
}

// Humanity Protocol types (v2 - OAuth SDK based)
export interface HumanityVerificationRequest {
  walletAddress: string
  accessToken?: string
  isHuman?: boolean
}

export interface HumanityVerificationResponse {
  is_human: boolean
  wallet_address: string
  verified_at?: string
  error?: string
}

export interface HumanityCachedVerification {
  walletAddress: string
  isHuman: boolean
  verifiedAt: Date
  expiresAt: Date
}

export interface HumanityPresetResult {
  preset: string
  status: 'valid' | 'invalid'
  value: boolean | string | null
  expiresAt?: string
}

export interface HumanityOAuthResult {
  isHuman: boolean
  accessToken: string
  presets: HumanityPresetResult[]
  verifiedAt: string
}
