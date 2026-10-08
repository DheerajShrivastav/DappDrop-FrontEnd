import { claims } from '@/config/claims'
import { explorerCodeUrl, network, repos, securityBuyerSummary } from '@/config/landing'

/**
 * S1-07: the proof row (plan §2.2): four checkable artefacts, no counts of users or money.
 * No H2; the list is labelled "Check our work". Each chip is one link whose accessible name is
 * its visible text plus where it goes, ending "(opens in a new tab)". (The plan asked for an
 * aria-label; axe 4.14's label-in-name check rejects that here, so it's an sr-only suffix.)
 * Later, BB-01's ledger rows render in this same slot (mainnet threshold only).
 *
 * Chip 3's number and link come from the same ref (F59): the deployed tag when it's set; until
 * then no number, and the link names "our latest contract code" (the repo's default branch).
 */
const CONTRACTS_BRANCH = 'dev'

type Chip = { id: string; title: string; detail: string; href: string; dest: string }



function chips(): Chip[] {
  const ref = claims.deployedTag ?? CONTRACTS_BRANCH
  const out: Chip[] = []

  const sourceUrl = explorerCodeUrl(network.entrypoint)
  if (sourceUrl) {
    out.push({
      id: 'etherscan',
      title: 'Verified on Etherscan',
      detail: `${network.deployedContracts} contracts · ${network.name}`,
      href: sourceUrl,
      dest: `the entrypoint contract's verified source on ${network.explorerName}`,
    })
  }

  out.push({
    id: 'code',
    title: claims.licenseFile ? 'Open source (MIT)' : 'Public code',
    detail: 'app and contracts',
    href: repos.contracts,
    dest: 'the contracts repository on GitHub',
  })

  const tests = claims.testsAtDeployed
  const where = claims.deployedTag ? `the deployed version (${claims.deployedTag})` : 'our latest contract code'
  out.push({
    id: 'tests',
    title: tests !== null ? `${tests} automated tests` : 'Automated tests',
    detail: `on ${where} · ${claims.invariantSuites} invariant suites`,
    href: `${repos.contracts}/tree/${ref}/test`,
    dest: `the contracts' test folder at ${ref} on GitHub`,
  })

  out.push({
    id: 'security_notes',
    title: 'Not audited yet',
    detail: securityBuyerSummary ? 'findings and fixes ↗' : 'our security notes (internal review, not an audit) ↗',
    href: `${repos.contracts}/blob/${ref}/docs/SECURITY_FINDINGS.md`,
    dest: 'our security findings document on GitHub',
  })
  return out
}

export function ProofSlot() {
  const items = chips()
  return (
    <section aria-label="Check our work" data-section="proof_row" className="border-y border-rule">
      <ul className="lp-container grid grid-cols-2 lg:grid-cols-4">
        {items.map((c, i) => (
          <li
            key={c.id}
            className={`border-rule ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
          >
            <a
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              data-dest={`proof_${c.id}`}
              data-proof={c.id}
              className="group flex h-full min-h-11 flex-col justify-center gap-1 px-3 py-4 sm:px-5"
            >
              <span className="text-small font-semibold text-ink underline decoration-signal decoration-1 underline-offset-[3px] can-hover:group-hover:decoration-2">
                {c.title}
              </span>
              <span className="font-mono text-[0.75rem] leading-5 text-ink-2">{c.detail}</span>
              {/* The name is the visible text plus this, so it always contains the label (2.5.3). */}
              <span className="sr-only">: {c.dest} (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
