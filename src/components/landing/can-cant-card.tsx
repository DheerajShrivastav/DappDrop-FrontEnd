import { claims } from '@/config/claims'
import { explorerCodeUrl, network, siteOrigin } from '@/config/landing'
import { PrintCardButton } from './print-card-button'

/**
 * S1-09: "What DappDrop can and can't do with your tokens" (#can-cant). Text from
 * CD-revisions §2.4 (TRS F49–F52, RED-03/04/08/10), with the flag paths that card defines:
 * - rolesSplit → "Our keys" splits into "Our task signer and fallback publisher" / "Our admin key",
 *   and the "one key" lead is replaced (S2-04);
 * - hostCloseGuarded → the host-close lines go (S2-05); hostCloseFixCommitted adds the
 *   commitment while it's unfixed;
 * - nftCustodyFixed → the NFT-module sentence goes (S2-06); nftFixCommitted likewise;
 * - tasksEnforcedOnChain → the contract column gains F37 ("Only our verifier or the contract
 *   itself can mark a task complete.");
 * - adminHardeningCommitted → the C5b line; relayerLive → the claim-gas line.
 * The "can't" list stays the four TRS-approved items (F52); it's only extended with TRS wording.
 *
 * On /security (07-wow IA §3): open at every width, a :target highlight, and a print path (AS-10).
 */
function Col({ title, items, link }: { title: string; items: React.ReactNode[]; link?: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-mono text-[0.8125rem] font-medium uppercase tracking-[0.04em] text-ink">
        {title} {link}
      </h3>
      <ul className="mt-2 space-y-1.5 text-small text-ink-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true" className="text-ink-3">
              –
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CanCantCard() {
  const c = claims
  const sourceUrl = explorerCodeUrl(network.entrypoint)
  const asOf = new Date().toISOString().slice(0, 10) // build date: the page is static

  const contract: React.ReactNode[] = [
    'Holds the reward. In DappDrop you fund it before your campaign opens.',
    'Pays out only by the published list, or by the tier rules.',
    'Opens claims 24 hours after a list is published. It’s a review window, not a veto: your community can flag a problem, and only the host can change the list.',
    'Once you close the campaign, participants have 30 days to claim; then you can take back the rest.',
    'Once anyone has joined, nobody can end it early. The end time can’t move.',
    'Sends a token reward only to the wallet it’s bound to.',
    ...(c.tasksEnforcedOnChain ? ['Only our verifier or the contract itself can mark a task complete.'] : []),
    <>
      <strong className="font-semibold text-ink">Doesn’t decide who gets paid.</strong> Our app proposes the list; the host publishes it.
    </>,
    ...(c.hostCloseGuarded
      ? []
      : [
          <>
            <strong className="font-semibold text-ink">Doesn’t force a payout today.</strong> A host can close a reward-list campaign
            without publishing a list, and take back the whole reward 30 days later.
            {c.hostCloseFixCommitted && ' We’re closing that gap in our next contract update.'}
          </>,
        ]),
  ]

  const signer: React.ReactNode[] = [
    <>
      Can mark a task done <strong className="font-semibold text-ink">or not done</strong> for any wallet while a campaign is open or
      ended.
    </>,
    `Build the reward list from task results and Humanity status; can publish a fallback list after 14 days of host silence${
      c.hostCloseGuarded ? '' : ', unless the host has closed the campaign'
    }.`,
    ...(c.relayerLive ? ['Can cover the gas for a claim.'] : []),
  ]

  const admin: React.ReactNode[] = [
    <>
      Can pause the contract. While it’s paused, nobody can move the rewards, including us.{' '}
      <strong className="font-semibold text-ink">Timers keep running during a pause.</strong>
    </>,
    'Can choose the fee, tier and NFT modules for campaigns set up after a change. A running campaign’s module is pinned: a new campaign pins the module that’s current when you set tiers or deposit NFTs.',
    ...(c.nftCustodyFixed
      ? []
      : [
          <>
            <strong className="font-semibold text-ink">Today, an NFT module registered this way could also move NFTs held for other campaigns.</strong>
            {c.nftFixCommitted && ' We’re closing that gap before mainnet.'}
          </>,
        ]),
    'Can give any of these roles to another address, and flag accounts.',
  ]

  const cant = [
    'Redirect a token reward away from the wallet it’s bound to.',
    'Change a campaign’s end time.',
    'Replace a list the host has published.',
    'End a campaign early.',
  ]

  const contractLink = sourceUrl ? (
    <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="lp-link normal-case tracking-normal text-ink-2" data-dest="explorer_card">
      (verified on {network.name} ↗<span className="sr-only">: the contract source on {network.explorerName}, opens in a new tab</span>)
    </a>
  ) : null

  return (
    <div id="can-cant" className="lp-target lp-print-card scroll-mt-24 rounded-lg border border-rule bg-surface">
      {/* 07-wow: on /security the card is the page's point, so it's server-rendered open at every
          width (founder decision 3), with the page's <h2>. Still a <details>, so it can fold away. */}
      <details className="lp-details group" open data-detail="can_cant">
        <summary className="flex min-h-11 items-center justify-between gap-4 px-5 py-4 sm:px-7">
          <h2 id="can-cant-title" tabIndex={-1} className="font-display text-title font-normal outline-none md:text-[2rem] md:leading-tight">
            What DappDrop can and can&apos;t do with your tokens
          </h2>
          <span aria-hidden="true" className="lp-chevron shrink-0 text-ink-3">
            ›
          </span>
        </summary>
        <div className="border-t border-rule px-5 pb-6 pt-4 sm:px-7">
          <p className="text-small text-ink">
            <strong className="font-semibold">
              {c.rolesSplit
                ? 'Our platform roles are held by separate keys: a task signer and fallback publisher, and an admin key.'
                : 'Today, one key holds every platform role below.'}
            </strong>
            {c.adminHardeningCommitted && ' Before mainnet: separate keys, a multisig and a time delay.'}
          </p>
          <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:gap-x-10">
            <Col title="The contract" link={contractLink} items={contract} />
            {c.rolesSplit ? (
              <>
                <Col title="Our task signer and fallback publisher" items={signer} />
                <Col title="Our admin key" items={admin} />
              </>
            ) : (
              <Col title="Our keys (one key today)" items={[...admin.slice(0, 1), ...signer.slice(0, 2), ...admin.slice(1), ...signer.slice(2)]} />
            )}
            <Col title="What we can’t do today" items={cant} />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4 print:hidden">
            <p className="font-mono text-[0.75rem] text-ink-3">As of {asOf}</p>
            <PrintCardButton />
          </div>
          <p className="mt-4 hidden font-mono text-[0.75rem] text-ink-3 print:block">
            {siteOrigin}/security#can-cant · as of {asOf}
          </p>
        </div>
      </details>
    </div>
  )
}
