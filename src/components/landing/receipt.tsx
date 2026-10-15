import { claims } from '@/config/claims'
import { explorerCodeUrl, network, repos } from '@/config/landing'
import { RECEIPTS, receiptTarget, receiptVisible, type ReceiptId } from '@/config/receipts'

/**
 * A receipt (plan §2.3): "Enforced by the contract · Check ↗" or "Done by our app".
 * Renders nothing when its fix flag is off (no receipt on an unfixed path) or when there's no
 * deployed code to point at. The link's accessible name is its visible text plus the rule, the
 * network and the version (F28; the sr-only suffix keeps WCAG 2.5.3 label-in-name).
 */
/** `compact`: only "Check ↗" is visible (where the surrounding text already says the rules are
 * enforced by the contract); the accessible name is unchanged. */
export function Receipt({ id, className = '', compact = false }: { id: ReceiptId; className?: string; compact?: boolean }) {
  if (!receiptVisible(id, claims)) return null
  const def = RECEIPTS[id]
  const base = `inline whitespace-nowrap font-mono text-[0.75rem] leading-5 text-ink-3 ${className}`

  if (def.kind === 'app') {
    return <span className={base}>Done by our app</span>
  }
  const target = receiptTarget(
    id,
    { deployedTag: claims.deployedTag, deployVersion: claims.deployVersion },
    {
      reposContracts: repos.contracts,
      networkName: network.name,
      explorerName: network.explorerName,
      codeUrl: explorerCodeUrl,
      addresses: { entrypoint: network.entrypoint, rewardModule: network.rewardModule, nftModule: network.nftModule },
    },
  )
  if (!target) return null
  return (
    <span className={base}>
      {compact ? <span className="sr-only">Enforced by the contract · </span> : <>Enforced by the contract ·{' '}</>}
      <a
        href={target.href}
        target="_blank"
        rel="noopener noreferrer"
        className="lp-link text-ink-2"
        data-receipt={id}
        data-dest={`receipt_${id}`}
      >
        Check ↗
        <span className="sr-only">
          : {def.title}, {target.where} (opens in a new tab)
        </span>
      </a>
    </span>
  )
}
