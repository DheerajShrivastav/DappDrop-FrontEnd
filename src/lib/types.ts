export type TaskType =
  | 'SOCIAL_FOLLOW'
  | 'JOIN_DISCORD'
  | 'JOIN_TELEGRAM'
  | 'RETWEET'
  | 'ONCHAIN_TX'

export type Task = {
  id: string
  type: TaskType
  description: string
  verificationData?: string
  discordInviteLink?: string // For JOIN_DISCORD tasks: the actual invite link for participants to join
  telegramInviteLink?: string // For JOIN_TELEGRAM tasks: the actual invite link for participants to join
  requiresHumanityVerification?: boolean // Whether this task requires Humanity Protocol verification
}

export type UserTask = {
  taskId: string
  completed: boolean
  isCompleting?: boolean
}

export type Reward = {
  type: 'ERC20' | 'ERC721' | 'None'
  tokenAddress: string
  amount?: string
  name: string
}

export type Campaign = {
  id: string
  title: string
  description: string // This is the short description
  longDescription: string
  startDate: Date
  endDate: Date
  status: 'Draft' | 'Open' | 'Ended' | 'Closed'
  participants: number
  host: string
  tasks: Task[]
  reward: Reward
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

// Humanity Protocol types
export interface HumanityVerificationRequest {
  walletAddress: string
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
