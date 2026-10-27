/**
 * App behaviour flags (08-site). Build-time, public (NEXT_PUBLIC_*), never secrets.
 */
export const appFlags = {
  /**
   * Gas-free (sponsored) claims: the PRIMARY claim button, offered to every wallet with a reward
   * (founder decision 2026-10-01: never gated on Humanity). Built as if the relayer is live; ON
   * unless NEXT_PUBLIC_SPONSORED_CLAIMS=off. When it's off, or when a gas-free request fails, the
   * claim buttons fall back automatically to "Claim with my wallet" as the primary
   * (<ClaimActions/> in src/components/app). Claiming with your own wallet always works.
   */
  sponsoredClaims: process.env.NEXT_PUBLIC_SPONSORED_CLAIMS !== 'off',
} as const
