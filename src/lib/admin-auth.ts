import 'server-only'

import { ethers } from 'ethers'
import { getEntrypointReadContract } from './web3-service'

/**
 * On-chain admin/moderator role checks for the admin console (P3 CP4). Every admin API route
 * gates on the CONNECTED wallet's session actually holding the role on-chain (a live hasRole
 * read against the entrypoint), never a client-side flag or a cached DB value — a role can be
 * revoked on-chain at any time and this must reflect that immediately.
 */

export type AdminRole = 'DEFAULT_ADMIN' | 'MODERATOR' | 'EMERGENCY_ADMIN' | 'SIGNER' | 'SETTLER'

const DEFAULT_ADMIN_ROLE = ethers.ZeroHash // OZ AccessControl's fixed DEFAULT_ADMIN_ROLE (0x00)

async function resolveRoleHash(role: AdminRole): Promise<string> {
  if (role === 'DEFAULT_ADMIN') return DEFAULT_ADMIN_ROLE
  const c = getEntrypointReadContract()
  if (role === 'MODERATOR') return c.MODERATOR_ROLE()
  if (role === 'EMERGENCY_ADMIN') return c.EMERGENCY_ADMIN()
  if (role === 'SIGNER') return c.SIGNER_ROLE()
  return c.SETTLER_ROLE()
}

export async function hasAdminRole(walletAddress: string, role: AdminRole): Promise<boolean> {
  try {
    const c = getEntrypointReadContract()
    const roleHash = await resolveRoleHash(role)
    return await c.hasRole(roleHash, walletAddress)
  } catch (e) {
    console.warn(`hasAdminRole(${role}) check failed:`, e)
    return false // fail closed — an RPC error must never be treated as "has the role"
  }
}

/** Check ALL admin roles at once for a wallet — powers the /admin UI's section gating. */
export async function getAdminRoles(walletAddress: string): Promise<Record<AdminRole, boolean>> {
  const roles: AdminRole[] = ['DEFAULT_ADMIN', 'MODERATOR', 'EMERGENCY_ADMIN', 'SIGNER', 'SETTLER']
  const results = await Promise.all(roles.map((r) => hasAdminRole(walletAddress, r)))
  return Object.fromEntries(roles.map((r, i) => [r, results[i]])) as Record<AdminRole, boolean>
}

/** Throws if the wallet does not hold `role`. Use at the top of any admin API route. */
export async function requireAdminRole(walletAddress: string, role: AdminRole): Promise<void> {
  const ok = await hasAdminRole(walletAddress, role)
  if (!ok) {
    throw new Error(`This action requires the ${role} role, which this wallet does not hold on-chain.`)
  }
}
