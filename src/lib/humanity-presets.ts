// src/lib/humanity-presets.ts
// Central registry of all supported Humanity Protocol presets.
// This is the single source of truth — used by the create-campaign UI,
// the verification modal, the callback page, and the backend API.
//
// Production-compatible scopes only:
//   identity:read — covers is_human, basic identity, email, phone, wallet addresses
//   kyc:read      — covers kyc_passed (whether a user has passed KYC)
//
// NOTE: Age-related credentials (identity:date_of_birth, is_18_plus, is_21_plus)
// and financial scopes only work in sandbox and are NOT available in production.

export type HumanityPreset =
  | 'is_human'
  | 'palm_verified'
  | 'kyc_passed'

export interface HumanityPresetConfig {
  preset: HumanityPreset
  label: string
  description: string
  /** OAuth scopes required to evaluate this preset */
  requiredScopes: string[]
  category: 'identity' | 'kyc'
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
    preset: 'kyc_passed',
    label: 'KYC Verified',
    description: 'User must have passed KYC identity document verification.',
    requiredScopes: ['openid', 'kyc:read'],
    category: 'kyc',
    icon: '🪪',
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

/**
 * Merge and deduplicate OAuth scopes required for multiple presets.
 * E.g. ['is_human', 'kyc_passed'] → ['openid', 'identity:read', 'kyc:read']
 */
export function getScopesForPresets(presets: string[]): string[] {
  const scopeSet = new Set<string>()
  for (const preset of presets) {
    for (const scope of getScopesForPreset(preset)) {
      scopeSet.add(scope)
    }
  }
  return Array.from(scopeSet)
}

/**
 * Normalize a preset value that may be a single string or an array to always be an array.
 * Handles backward compatibility with old campaigns that stored a single string.
 */
export function normalizePresets(value: string | string[] | undefined | null): string[] {
  if (!value) return [DEFAULT_PRESET]
  if (Array.isArray(value)) return value.length > 0 ? value : [DEFAULT_PRESET]
  return [value]
}

/** Validates that a string is a known preset key. */
export function isValidPreset(preset: string): preset is HumanityPreset {
  return HUMANITY_PRESETS.some((p) => p.preset === preset)
}

/** The fallback / default preset used when no preset is configured on a task. */
export const DEFAULT_PRESET: HumanityPreset = 'is_human'

