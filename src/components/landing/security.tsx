import { claims } from '@/config/claims'
import { explorerCodeUrl, network, officialDomain, repos, securityBuyerSummary, securityContact } from '@/config/landing'
import { CanCantCard } from './can-cant-card'
import { IntentPrefetch } from './intent-prefetch'
import { MoneyDiagram } from './money-diagram'
import { START_HREF } from './nav'
import { Receipt } from './receipt'
import { SecurityLog } from './security-log'
import { Section } from './section'
import { pillButtonOnBand } from './ui'

/**
 * S1-12 → 07-wow IA §3: the /security sections, "Check our work" (TRS F53–F63, F85). No seals,
 * shields or audit-like badges. Order: status → custody → can/can't → build → notes → stay safe
 * → the closing band. Flag paths: rolesSplit (Status today, S2-04), adminHardeningCommitted
 * (C5b), licenseFile (C6), securityLogApproved (S2-07; D12 default: the notes link only),
 * paymentTaskChainLocked (the "never ask for real funds" line), deployedTag/testsAtDeployed
 * (one ref for the tests line, F59). F57 "No proxy" sits on the same page as the card's admin
 * column (F51); the custody pair always travels with the pause line (O7).
 */
const CONTRACTS_BRANCH = 'dev'
const ref = claims.deployedTag ?? CONTRACTS_BRANCH

function Fact({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 border-t border-rule py-3">
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

export function SecurityHero() {
  return (
    <section aria-labelledby="hero-title" data-section="hero" className="lp-container pb-6 pt-12 md:pb-10 md:pt-20">
      <p className="font-mono text-eyebrow font-medium uppercase text-ink-3">Security</p>
      <h1 id="hero-title" className="mt-3 max-w-[16ch] font-display text-display-xl font-normal text-ink">
        Check our work.
      </h1>
      <p className="mt-5 max-w-[40rem] text-lead text-ink-2">
        Not audited by a third party yet. Here&apos;s what we do instead, and what we can and can&apos;t do with your tokens.
      </p>
    </section>
  )
}

export function SecurityStatus() {
  const status = [
    `Public beta on ${network.name}`,
    'Not audited yet',
    claims.rolesSplit ? 'Platform roles on separate keys' : 'One key holds every platform role',
    ...(claims.contractsDeployedOn ? [`Contracts last deployed ${claims.contractsDeployedOn}`] : []),
    `Next contract update: ${claims.nextContractUpdate ?? 'pending'}`,
  ]
  return (
    <section id="status" aria-labelledby="status-title" data-section="status" className="scroll-mt-20">
      <div className="lp-container">
        <h2 id="status-title" className="font-mono text-eyebrow font-medium uppercase text-ink-3">
          Status today
        </h2>
        <p className="mt-3 rounded border border-rule bg-sunk px-3 py-2.5 font-mono text-[0.8125rem] leading-6 text-ink">{status.join(' · ')}</p>
      </div>
    </section>
  )
}

export function SecurityCustody() {
  return (
    <Section id="custody" track="custody" eyebrow="Custody" title="Where your reward sits, and who can move it">
      <div className="mt-8 grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="space-y-3 text-small text-ink-2 md:text-body lg:col-span-6">
          <p>
            In DappDrop, you fund an on-chain escrow contract before your campaign opens; the reward stays there until it&apos;s
            claimed or you take it back.
          </p>
          <p>
            Your reward never sits in a DappDrop wallet. In an emergency, our admin key can pause the contract; while it&apos;s paused,
            nobody can move the rewards, including us. Timers keep running during a pause.
            {claims.adminHardeningCommitted && ' Before mainnet: separate keys, a multisig and a time delay.'}
          </p>
        </div>
        <div className="lg:col-span-6">
          <MoneyDiagram />
        </div>
      </div>
    </Section>
  )
}

export function SecurityCanCant() {
  return (
    <section aria-labelledby="can-cant-title" data-section="can_cant" className="lp-container">
      <CanCantCard />
    </section>
  )
}

export function SecurityBuild() {
  const testsWhere = claims.deployedTag ? `the deployed version (${claims.deployedTag})` : 'our latest contract code'
  const tests = claims.testsAtDeployed !== null ? `${claims.testsAtDeployed} automated tests` : 'Automated tests'
  const sourceUrl = explorerCodeUrl(network.entrypoint)
  return (
    <Section id="build" track="build" eyebrow="Engineering" title="How we build it">
      <ul className="mt-6 max-w-[48rem] border-b border-rule text-small text-ink-2 md:mt-8 md:text-body">
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
    </Section>
  )
}

export function SecurityNotes() {
  const notesHref = `${repos.contracts}/blob/${ref}/docs/SECURITY_FINDINGS.md`
  return (
    <Section id="notes" track="notes" eyebrow="Disclosure" title="Security notes">
      <div className="mt-6 max-w-[44rem] space-y-4 text-small text-ink-2 md:text-body">
        <p>
          <Out href={notesHref} dest="security_notes" name="our security findings document on GitHub">
            {securityBuyerSummary ? 'Findings and fixes ↗' : 'Our security notes (internal review, not an audit) ↗'}
          </Out>
        </p>
        <SecurityLog />
        <p>
          <strong className="font-semibold text-ink">Report a problem:</strong>{' '}
          {securityContact ? (
            <a href={`mailto:${securityContact}`} className="lp-link">
              {securityContact}
            </a>
          ) : (
            <>
              <Out href={`${repos.contracts}/issues`} dest="security_report" name="the contracts repository's issues on GitHub">
                open an issue on GitHub ↗
              </Out>
              . Never post a seed phrase or private key.
            </>
          )}
        </p>
      </div>
    </Section>
  )
}

export function SecuritySafe() {
  return (
    <section id="safe" aria-labelledby="safe-title" data-section="safe" className="scroll-mt-20">
      <div className="lp-container pb-[var(--section-y)]">
        <div className="max-w-[44rem] rounded-lg border border-rule bg-surface p-5 text-small text-ink-2 md:p-7 md:text-body">
          <h2 id="safe-title" tabIndex={-1} className="font-display text-title font-normal text-ink outline-none">
            Stay safe
          </h2>
          <p className="mt-2">
            <strong className="font-semibold text-ink">We will never ask for your seed phrase or private key.</strong> DappDrop only asks
            you to sign in (a free signature that shows our domain) and to approve transactions you start yourself. The official site is{' '}
            <strong className="font-semibold text-ink">{officialDomain}</strong>; anything else isn&apos;t us.
            {claims.paymentTaskChainLocked && ' We will never ask you to send real funds during the beta.'}
          </p>
        </div>
      </div>
    </section>
  )
}

/** The closing band (IA §3 order 7): a primary CTA straight to the app + "What you'll need". */
export function SecurityStart() {
  return (
    <section id="start" aria-labelledby="start-title" data-section="security_start" className="lp-ink scroll-mt-20">
      <div className="lp-container section-y">
        <h2 id="start-title" tabIndex={-1} className="font-display text-display-l font-normal text-paper outline-none">
          Seen enough?
        </h2>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <IntentPrefetch href={START_HREF} className={pillButtonOnBand} cta="security_to_start" loc="security">
            {network.testnet ? 'Start a test campaign' : 'Start a campaign'}
          </IntentPrefetch>
          <a href="/how-it-works#start" className="lp-link inline-flex min-h-11 items-center text-paper" data-cta="security_needs" data-loc="security">
            What you&apos;ll need →
          </a>
        </div>
      </div>
    </section>
  )
}
