import { claims } from '@/config/claims'
import { explorerCodeUrl, network, officialDomain, repos, securityBuyerSummary } from '@/config/landing'
import { CanCantCard } from './can-cant-card'
import { Receipt } from './receipt'
import { SecurityLog } from './security-log'
import { Section } from './section'

/**
 * S1-12: #security, "Check our work" (plan §2.6; TRS F53–F63, F85). No seals, shields or
 * audit-like badges. Flag paths: rolesSplit (Status today, S2-04), adminHardeningCommitted
 * (C5b), licenseFile (C6), securityLogApproved (S2-07; D12 default: the notes link only),
 * paymentTaskChainLocked (the "never ask for real funds" line), deployedTag/testsAtDeployed
 * (tests line from the same ref as the proof row, S2-08).
 */
const CONTRACTS_BRANCH = 'dev'

function Fact({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 border-t border-rule py-2.5">
      <span aria-hidden="true" className="text-ink-3">
        –
      </span>
      <span>{children}</span>
    </li>
  )
}

function Out({ href, children, dest, name }: { href: string; children: React.ReactNode; dest: string; name: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="lp-link" data-dest={dest}>
      {children}
      <span className="sr-only">: {name} (opens in a new tab)</span>
    </a>
  )
}

export function Security() {
  const ref = claims.deployedTag ?? CONTRACTS_BRANCH
  const notesHref = `${repos.contracts}/blob/${ref}/docs/SECURITY_FINDINGS.md`
  const testsWhere = claims.deployedTag ? `the deployed version (${claims.deployedTag})` : 'our latest contract code'
  const tests = claims.testsAtDeployed !== null ? `${claims.testsAtDeployed} automated tests` : 'Automated tests'
  const sourceUrl = explorerCodeUrl(network.entrypoint)

  const status = [
    `Public beta on ${network.name}`,
    'Not audited yet',
    claims.rolesSplit ? 'Platform roles on separate keys' : 'One key holds every platform role',
    ...(claims.contractsDeployedOn ? [`Contracts last deployed ${claims.contractsDeployedOn}`] : []),
    `Next contract update: ${claims.nextContractUpdate ?? 'pending'}`,
  ]

  return (
    <Section
      id="security"
      track="security"
      eyebrow="04 — Security"
      title="Check our work."
      dek="Not audited by a third party yet. Here’s what we do instead, and what we can and can’t do with your tokens."
    >
      <p className="mt-6 hidden max-w-[44rem] text-ink-2 md:block md:text-body">
        Your reward never sits in a DappDrop wallet. In an emergency, our admin key can pause the contract; while it&apos;s paused,
        nobody can move the rewards, including us. Timers keep running during a pause.
        {claims.adminHardeningCommitted && ' Before mainnet: separate keys, a multisig and a time delay.'}
      </p>

      <CanCantCard />

      <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <details className="lp-details" data-open-desktop data-detail="how_we_build">
          <summary className="flex min-h-11 items-center justify-between gap-4">
            <h3 className="text-title font-semibold">How we build it</h3>
            <span aria-hidden="true" className="lp-chevron text-ink-3 lg:hidden">›</span>
          </summary>
          <ul className="mt-3 border-b border-rule text-small text-ink-2 md:text-body">
            <Fact>
              {claims.licenseFile ? 'Open source (MIT): the app and the contracts.' : 'Public code: the app and the contracts.'}{' '}
              <Out href={repos.contracts} dest="security_code" name="the contracts repository on GitHub">
                Contracts ↗
              </Out>{' '}
              <Out href={repos.app} dest="security_app_code" name="the app repository on GitHub">
                App ↗
              </Out>
            </Fact>
            <Fact>
              All deployed contracts verified on {network.explorerName}.{' '}
              {sourceUrl && (
                <Out href={sourceUrl} dest="etherscan" name={`the entrypoint's verified source on ${network.explorerName}`}>
                  Check ↗
                </Out>
              )}
            </Fact>
            <Fact>
              No proxy: the core contract can&apos;t be upgraded, and a campaign&apos;s payout logic is pinned once it&apos;s set.{' '}
              <Receipt id="noProxy" />
            </Fact>
            <Fact>Built on OpenZeppelin libraries for access control, safe token transfers and reentrancy protection.</Fact>
            <Fact>
              {tests} on {testsWhere}, including {claims.invariantSuites} invariant suites.{' '}
              <Out href={`${repos.contracts}/tree/${ref}/test`} dest="security_tests" name={`the contracts' test folder at ${ref} on GitHub`}>
                Tests ↗
              </Out>
            </Fact>
            <Fact>Static analysis (Slither, Aderyn) for every security change, with results published.</Fact>
          </ul>
          </details>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <div>
            <h3 className="text-title font-semibold">Status today</h3>
            <p className="mt-3 rounded border border-rule bg-sunk px-3 py-2 font-mono text-[0.75rem] leading-6 text-ink">
              {status.join(' · ')}
            </p>
          </div>

          <p className="text-small md:text-body">
            <Out href={notesHref} dest="security_notes" name="our security findings document on GitHub">
              {securityBuyerSummary ? 'Findings and fixes ↗' : 'Our security notes (internal review, not an audit) ↗'}
            </Out>
          </p>
          <SecurityLog />

          <div className="rounded-lg border border-rule bg-surface p-5 text-small text-ink-2">
            <h3 className="font-semibold text-ink md:text-body">Stay safe</h3>
            <p className="mt-1.5">
              <strong className="font-semibold text-ink">We will never ask for your seed phrase or private key.</strong> DappDrop only asks
              you to sign in (a free signature that shows our domain) and to approve transactions you start yourself. The official site is{' '}
              <strong className="font-semibold text-ink">{officialDomain}</strong>; anything else isn&apos;t us.
              {claims.paymentTaskChainLocked && ' We will never ask you to send real funds during the beta.'}
            </p>
          </div>
        </div>
      </div>

      <p className="mt-8">
        <a href="#start" className="lp-link inline-flex min-h-11 items-center font-medium" data-cta="security_to_start" data-loc="security">
          Seen enough? Here&apos;s what you&apos;ll need to start ↓
        </a>
      </p>
    </Section>
  )
}
