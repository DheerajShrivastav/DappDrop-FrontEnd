import { claims } from '@/config/claims'
import { latestDeployed, securityLog, securityLogVisible } from '@/config/security-log'

/**
 * S2-07: the latest three DEPLOYED fixes, "Found by {method} · Deployed {date}". A closed
 * <details> on phone, open on desktop. Renders nothing unless securityLogApproved (D12; default
 * off), a fix is deployed and the log has entries.
 */
export function SecurityLog() {
  if (!securityLogVisible(claims, securityLog)) return null
  const items = latestDeployed(securityLog)
  return (
    <details className="lp-details mt-6 rounded-lg border border-rule bg-surface" data-open-desktop data-detail="security_log">
      <summary className="flex min-h-11 items-center justify-between px-5 py-3">
        <h3 className="text-small font-semibold md:text-body">Latest security fixes, deployed</h3>
        <span aria-hidden="true" className="lp-chevron text-ink-3 lg:hidden">
          ›
        </span>
      </summary>
      <ul className="border-t border-rule px-5 py-3 text-small">
        {items.map((e) => (
          <li key={e.title + e.deployedOn} className="py-1.5">
            <span className="font-medium">{e.title}</span>
            <span className="block font-mono text-[0.75rem] text-ink-2">
              Found by {e.foundBy} · Deployed {e.deployedOn}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
