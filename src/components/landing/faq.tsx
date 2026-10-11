import { claims } from '@/config/claims'
import { network, networkLabel, repos } from '@/config/landing'
import { Section } from './section'
import { primaryButton } from './ui'

/**
 * S1-14: #faq, "Fair questions" (plan §2.9; TRS F71–F77). Eight native <details>, each linkable
 * (#faq-*); #faq-beta opens on load and on hash change (HashDetailsOpener). 0 KB of FAQ JS.
 * Flag paths: tieredCancelLive (Q4, S2-03), tierModuleFixed (Q5 "or points", S2-03),
 * tasksEnforcedOnChain (Q5 drops the rank-race caveat, S2-02), humanityNaming (Q6),
 * deployedTag/testsAtDeployed (Q3, S2-08), founderContact (the closing link, C2).
 */
type Q = { id: string; q: string; a: React.ReactNode }

export function Faq() {
  const ref = claims.deployedTag ?? 'dev'
  const tests =
    claims.testsAtDeployed !== null
      ? `${claims.testsAtDeployed} automated tests on the deployed version (${claims.deployedTag})`
      : 'automated tests on our latest contract code'
  const human = claims.humanityNaming ? ' (Humanity Protocol sign-in)' : ' (a verified-human check)'
  const tiered = claims.tasksEnforcedOnChain && claims.tierModuleFixed

  const qs: Q[] = [
    {
      id: 'faq-beta',
      q: `What does “public beta on ${networkLabel}” mean for me?`,
      a: network.testnet ? (
        <>
          {network.name} is Ethereum&apos;s test network. You run a complete campaign with test tokens that have no real value.
          Production will run on a single EVM Layer 2, to be announced.
        </>
      ) : (
        <>DappDrop is in public beta. Production will run on a single EVM Layer 2, to be announced.</>
      ),
    },
    {
      id: 'faq-custody',
      q: 'Where does my reward sit, and who can move it?',
      a: (
        <>
          In DappDrop, you fund an on-chain escrow contract before your campaign opens; the reward stays there until it&apos;s
          claimed or you take it back. Your reward never sits in a DappDrop wallet. In an emergency, our admin key can pause the
          contract; while it&apos;s paused, nobody can move the rewards, including us. Timers keep running during a pause.{' '}
          <a href="#can-cant" className="lp-link text-ink">
            See exactly what our keys can do ↓
          </a>
        </>
      ),
    },
    {
      id: 'faq-audit',
      q: 'Is DappDrop audited?',
      a: (
        <>
          Not yet. Public code, verified contracts, OpenZeppelin libraries, {tests}, including {claims.invariantSuites} invariant
          suites, and static analysis for every security change.{' '}
          <a href={`${repos.contracts}/blob/${ref}/docs/SECURITY_FINDINGS.md`} target="_blank" rel="noopener noreferrer" className="lp-link text-ink" data-dest="security_notes">
            Our security notes ↗<span className="sr-only">: an internal review, not an audit, on GitHub (opens in a new tab)</span>
          </a>
        </>
      ),
    },
    {
      id: 'faq-unclaimed',
      q: 'What if nobody joins, or rewards go unclaimed?',
      a: (
        <>
          If nobody has joined, cancel and get your reward back right away
          {claims.tieredCancelLive ? '' : ' (tiered campaigns: after the next contract update)'}. Once you close the campaign,
          participants have 30 days to claim; then you can take back whatever&apos;s left.
        </>
      ),
    },
    {
      id: 'faq-wrong-list',
      q: 'What if the reward list is wrong?',
      a: (
        <>
          The list is public for 24 hours before claims open; publish a corrected list and the 24 hours restart. It&apos;s a review
          window, not a veto. Or pay by rank{claims.tierModuleFixed ? ' or points' : ''}, and the contract computes the payouts from
          on-chain results.
          {claims.tasksEnforcedOnChain ? '' : ' We don’t recommend rank races until our next contract update.'}
        </>
      ),
    },
    {
      id: 'faq-bots',
      q: 'Does DappDrop stop bots?',
      a: (
        <>
          No tool stops every bot. For reward-list campaigns, turn on “Humanity-verified wallets only”{human} and unverified wallets
          are left off the reward list. Optional.
          {tiered && ' For tiered campaigns, it adds a required verified-human task that the contract enforces.'} Tasks we can&apos;t
          check, like follows on X, are labelled self-reported.
        </>
      ),
    },
    {
      id: 'faq-cost',
      q: 'What does it cost, and do I need a developer?',
      a: <>No platform fee during the beta; gas applies. No code: four guided steps, optional AI drafting, and every transaction shown before you sign.</>,
    },
    {
      id: 'faq-reach',
      q: 'Will people find my campaign?',
      a: (
        <>
          Honestly: during the beta, most participants will come from your own channels. Your campaign has a page you can share
          anywhere. Projects create their own campaigns, and DappDrop doesn&apos;t vet hosts during the beta.
        </>
      ),
    },
  ]

  return (
    <Section id="faq" track="faq" title="Fair questions." dek="The things growth leads ask before they put a budget into a campaign.">
      <div className="mt-6 border-b border-rule md:mt-8">
        {qs.map((x) => (
          <details key={x.id} id={x.id} className="lp-details lp-target scroll-mt-24 border-t border-rule" data-faq={x.id.replace('faq-', '')}>
            <summary className="flex min-h-11 items-center justify-between gap-4 py-2 md:py-3">
              <h3 className="text-small font-semibold md:text-body">{x.q}</h3>
              <span aria-hidden="true" className="lp-chevron shrink-0 text-ink-3">
                ›
              </span>
            </summary>
            <p className="max-w-[44rem] pb-4 text-small text-ink-2 md:text-body">{x.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8 sm:items-center sm:gap-6">
        <a href="#start" className={primaryButton} data-cta="faq_start" data-loc="faq">
          Start a test campaign
        </a>
        {claims.founderContact ? (
          <a href={claims.founderContact.url} target="_blank" rel="noopener noreferrer" className="lp-link inline-flex min-h-11 items-center" data-cta="talk_founder" data-loc="faq">
            Talk to the founder (20 min)<span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <a href={`${repos.app}/issues`} target="_blank" rel="noopener noreferrer" className="lp-link inline-flex min-h-11 items-center" data-dest="github_issues">
            Questions? Ask on GitHub ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
    </Section>
  )
}
