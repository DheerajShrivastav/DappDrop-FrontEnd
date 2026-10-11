import { claims } from '@/config/claims'
import { network, networkLabel, repos } from '@/config/landing'
import { IntentPrefetch } from './intent-prefetch'
import { LeadForm } from './lead-form'

/**
 * S1-14: #start, "Here's what you'll need" (plan §2.10; TRS F78–F81), on the ink band that runs
 * into the footer. Flag paths:
 * - hostCloseGuarded → the band line "Don't promise rewards. Lock them in." (S2-05; RED-03);
 * - faucetUrl / testToken (C9) → steps 2–3 link the faucet / offer the token, else the fallbacks;
 * - founderContact (C2) / foundingHosts.open (C1) → the exits; privacyNoticeUrl (D11) → waitlist.
 * The phone note (F80) waits for the UXA app test. On ink: paper / paper-2 text and
 * signal-on-ink only (never ink-3 or the accent).
 */
export function StartPanel() {
  const gas = network.gasToken
  const help = claims.founderContact ? (
    <a href={claims.founderContact.url} target="_blank" rel="noopener noreferrer" className="lp-link">
      Talk to the founder<span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <a href={`${repos.app}/issues`} target="_blank" rel="noopener noreferrer" className="lp-link" data-dest="github_issues">
      Ask on GitHub ↗<span className="sr-only"> (opens in a new tab)</span>
    </a>
  )

  const steps: { title: string; body: React.ReactNode }[] = [
    { title: `A wallet on ${network.name}.`, body: 'Connect it and sign in. It’s a free signature, never a transaction.' },
    {
      title: `A little ${gas} for gas.`,
      body: claims.faucetUrl ? (
        <>
          Free from a faucet:{' '}
          <a href={claims.faucetUrl} target="_blank" rel="noopener noreferrer" className="lp-link" data-dest="faucet">
            {new URL(claims.faucetUrl).host} ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </>
      ) : (
        <>You&apos;ll need a little {network.name} test ETH for gas.</>
      ),
    },
    {
      title: 'A test token or NFT for the reward.',
      body: claims.testToken ? (
        <>Don&apos;t have one? Use ours: {claims.testToken.symbol}.</>
      ) : (
        <>
          You&apos;ll need a {network.name} test token or NFT for the reward. Need help getting test tokens? {help}
        </>
      ),
    },
    { title: 'One transaction to register as a host.', body: 'Then the wizard takes you through details, tasks, rewards and review.' },
  ]

  return (
    <section id="start" aria-labelledby="start-title" data-section="start" className="lp-ink scroll-mt-20">
      <div className="lp-container section-y">
        {claims.hostCloseGuarded && (
          <p className="font-display text-[1.75rem] leading-tight text-paper md:text-[2.25rem]">Don&apos;t promise rewards. Lock them in.</p>
        )}
        <h2 id="start-title" tabIndex={-1} className="mt-4 font-display text-display-l font-normal text-paper outline-none">
          Here&apos;s what you&apos;ll need.
        </h2>
        <p className="mt-3 text-lead text-paper-2">Four steps from here to a funded test campaign.</p>

        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <ol className="space-y-4 lg:col-span-7">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4 border-t border-[#3A3834] pt-4" data-step={i + 1}>
                <span className="font-mono text-[0.875rem] text-paper-2" aria-hidden="true">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="text-body font-semibold text-paper">{s.title}</h3>
                  <p className="mt-1 text-small text-paper-2">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="lg:col-span-5">
            <p className="text-small text-paper-2">No platform fee during beta. Gas is paid in {gas}.</p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-paper-2 px-2.5 py-1 font-mono text-[0.75rem] uppercase text-paper">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-paper" />
              Public beta · {networkLabel}
            </p>
            <div className="mt-5">
              <IntentPrefetch
                href="/create-campaign"
                className="inline-flex h-12 w-full items-center justify-center rounded-sm border border-transparent bg-paper px-5 text-body font-semibold leading-none text-ink active:translate-y-px sm:w-auto"
              >
                Continue to the app
              </IntentPrefetch>
              <p className="mt-2.5 text-small text-paper-2">Next: your wallet asks you to sign in. It&apos;s free and doesn&apos;t move funds.</p>
            </div>
            <ul className="mt-6 space-y-1 text-small text-paper">
              {claims.founderContact && (
                <li>
                  <a href={claims.founderContact.url} target="_blank" rel="noopener noreferrer" className="lp-link inline-flex min-h-11 items-center" data-cta="talk_founder" data-loc="start">
                    Prefer a walkthrough? Talk to the founder →<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              )}
              {claims.foundingHosts.open && claims.privacyNoticeUrl && (
                <li>
                  <a href="#founding" className="lp-link inline-flex min-h-11 items-center" data-cta="founding_from_start" data-loc="start">
                    Want a guided setup? Apply as a founding host →
                  </a>
                </li>
              )}
            </ul>
            {claims.privacyNoticeUrl && (
              <div className="mt-6 border-t border-[#3A3834] pt-5">
                <h3 className="text-body font-semibold text-paper">Not ready yet? Get one email when we launch on mainnet</h3>
                <div className="mt-3">
                  <LeadForm
                    form="waitlist"
                    onDark
                    fields={[
                      { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@project.xyz', required: true },
                      { name: 'chain', label: 'Your chain' },
                      { name: 'budget', label: 'Rough reward budget' },
                    ]}
                    submitLabel="Notify me"
                    success="You’re on the list. One email at mainnet, nothing else."
                    privacyUrl={claims.privacyNoticeUrl}
                    privacyLine="One email at mainnet, nothing else."
                  >
                    <div className="mt-4">
                      <LeadForm
                        form="poll"
                        onDark
                        fields={[{ name: 'reason', label: 'What’s stopping you from starting today?', type: 'textarea' }]}
                        submitLabel="Send"
                        success="Thanks for telling us."
                        privacyUrl={claims.privacyNoticeUrl}
                        privacyLine="Optional."
                      />
                    </div>
                  </LeadForm>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
