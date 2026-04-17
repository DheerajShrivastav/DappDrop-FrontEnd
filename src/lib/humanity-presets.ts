// src/lib/humanity-presets.ts
// Central registry of all supported Humanity Protocol presets.
// This is the single source of truth — used by the create-campaign UI,
// the verification modal, the callback page, and the backend API.

export type HumanityPreset =
  | 'is_human'
  | 'palm_verified'
  | 'is_18_plus'
  | 'is_21_plus'
  | 'kyc_passed'
  | 'country_of_residence'
  | 'residency_region'
  | 'net_worth_above_10k'
  | 'net_worth_above_100k'
  | 'proof_of_assets'

export interface HumanityPresetConfig {
  preset: HumanityPreset
  label: string
  description: string
  /** OAuth scopes required to evaluate this preset */
  requiredScopes: string[]
  category: 'identity' | 'age' | 'kyc' | 'financial'
  /** Emoji / icon hint for UI */
  icon: string
}

export const HUMANITY_PRESETS: HumanityPresetConfig[] = [
  {
    preset: 'is_human',
    label: 'Proof of Humanity',
    description: 'User must complete a palm/vein biometric scan.',
    requiredScopes: ['openid', 'identity:read'],
    category: 'identity',
    icon: '🫱',
  },
  {
    preset: 'palm_verified',
    label: 'Palm Verified',
    description: 'User must have completed the palm verification step.',
    requiredScopes: ['openid', 'identity:read'],
    category: 'identity',
    icon: '✋',
  },
  {
    preset: 'is_18_plus',
    label: 'Age 18+',
    description: 'User must be 18 years or older.',
    requiredScopes: ['openid', 'identity:date_of_birth'],
    category: 'age',
    icon: '🔞',
  },
  {
    preset: 'is_21_plus',
    label: 'Age 21+',
    description: 'User must be 21 years or older.',
    requiredScopes: ['openid', 'identity:date_of_birth'],
    category: 'age',
    icon: '🍺',
  },
  {
    preset: 'kyc_passed',
    label: 'KYC Verified',
    description: 'User must have passed KYC identity document verification.',
    requiredScopes: ['openid', 'kyc:read'],
    category: 'kyc',
    icon: '🪪',
  },
  {
    preset: 'country_of_residence',
    label: 'Country of Residence',
    description: 'User must have a verified country of residence on record.',
    requiredScopes: ['openid', 'identity:read'],
    category: 'identity',
    icon: '🌍',
  },
  {
    preset: 'residency_region',
    label: 'Residency Region',
    description: 'User must have a verified residency region (EU, APAC, NA, etc.).',
    requiredScopes: ['openid', 'identity:read'],
    category: 'identity',
    icon: '🗺️',
  },
  {
    preset: 'net_worth_above_10k',
    label: 'Net Worth > $10K',
    description: 'User must have a verified net worth above $10,000.',
    requiredScopes: ['openid', 'financial:net_worth'],
    category: 'financial',
    icon: '💰',
  },
  {
    preset: 'net_worth_above_100k',
    label: 'Net Worth > $100K',
    description: 'User must have a verified net worth above $100,000.',
    requiredScopes: ['openid', 'financial:net_worth'],
    category: 'financial',
    icon: '💎',
  },
  {
    preset: 'proof_of_assets',
    label: 'Proof of Assets',
    description: 'User must have verified assets on record.',
    requiredScopes: ['openid', 'financial:net_worth'],
    category: 'financial',
    icon: '🏦',
  },
]

/** Returns the preset config for a given preset key, or undefined if not found. */
export function getPresetConfig(preset: string): HumanityPresetConfig | undefined {
  return HUMANITY_PRESETS.find((p) => p.preset === preset)
}

/** Returns the required OAuth scopes for a given preset key.
 *  Defaults to ['openid', 'identity:read'] (minimum for is_human) if not found. */
export function getScopesForPreset(preset: string): string[] {
  return getPresetConfig(preset)?.requiredScopes ?? ['openid', 'identity:read']
}

/** Validates that a string is a known preset key. */
export function isValidPreset(preset: string): preset is HumanityPreset {
  return HUMANITY_PRESETS.some((p) => p.preset === preset)
}

/** The fallback / default preset used when no preset is configured on a task. */
export const DEFAULT_PRESET: HumanityPreset = 'is_human'
