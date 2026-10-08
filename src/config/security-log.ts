/**
 * S2-07: the security log's data rules (RED-05, F62, C16).
 * - Only entries with `deployedOn` ever render: "Fixed" alone is banned, and an item that's
 *   still exploitable on the live deployment never shows.
 * - The log renders only with `securityLogApproved` (founder, D12) and at least one fix deployed.
 * - Copy is TRS-approved before it goes into src/content/security-log.json.
 * Pure module, so the validator is unit-tested.
 */
import raw from '@/content/security-log.json'
import type { Claims } from './claims'

export type SecurityLogEntry = {
  /** Short, plain-English title of the finding, e.g. "Cross-campaign drain". */
  title: string
  /** How it was found, e.g. "our fuzz suite", "internal review". */
  foundBy: string
  /** ISO date the fix was deployed to the live contracts. Required. */
  deployedOn: string
  /** Optional link to the finding in SECURITY_FINDINGS.md at the deployed tag. */
  href?: string
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Returns the problems with an entry list; empty when every entry is valid. */
export function validateSecurityLog(entries: unknown): string[] {
  if (!Array.isArray(entries)) return ['security-log.json must be an array']
  const errors: string[] = []
  entries.forEach((e, i) => {
    const o = (e ?? {}) as Record<string, unknown>
    if (typeof o.title !== 'string' || !o.title.trim()) errors.push(`#${i}: title is required`)
    if (typeof o.foundBy !== 'string' || !o.foundBy.trim()) errors.push(`#${i}: foundBy is required`)
    if (typeof o.deployedOn !== 'string' || !ISO.test(o.deployedOn)) errors.push(`#${i}: deployedOn (YYYY-MM-DD) is required: only deployed fixes may be listed`)
    if (o.href !== undefined && (typeof o.href !== 'string' || !o.href.startsWith('https://'))) errors.push(`#${i}: href must be https`)
  })
  return errors
}

/** The three latest deployed entries, newest first. */
export function latestDeployed(entries: SecurityLogEntry[], n = 3): SecurityLogEntry[] {
  return entries
    .filter((e) => ISO.test(e.deployedOn))
    .sort((a, b) => b.deployedOn.localeCompare(a.deployedOn))
    .slice(0, n)
}

export function securityLogVisible(c: Pick<Claims, 'securityLogApproved' | 'tasksEnforcedOnChain' | 'tierModuleFixed' | 'tieredCancelLive'>, entries: SecurityLogEntry[]): boolean {
  return c.securityLogApproved && (c.tasksEnforcedOnChain || c.tierModuleFixed || c.tieredCancelLive) && latestDeployed(entries).length > 0
}

export const securityLog: SecurityLogEntry[] = raw as SecurityLogEntry[]
