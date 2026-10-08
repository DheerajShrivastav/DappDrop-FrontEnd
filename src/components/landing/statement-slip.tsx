import { claims } from '@/config/claims'
import { explorerCodeUrl, network, networkLabel } from '@/config/landing'
import { SlipTrace } from './slip-trace'

/**
 * S1-05: the Escrow Statement slip (plan §2.1; AS-1). Server-rendered HTML: the rest state is
 * the completed statement, readable with JS off. The footnotes ①–⑤ are its text alternative and
 * the motion's captions, visible in every mode. `data-b` marks what the trace (S1-06) animates.
 *
 * TRS row checklist (fact sheet §n; TRS-factcheck row):
 * - Header "ESCROW STATEMENT · EXAMPLE · {NETWORK}" / "Example campaign · Equal split · reward list": S5, F40.
 * - Taken from your wallet / Escrowed 1,000 EXAMPLE: §2 wizard funding breakdown, F41. The ticker
 *   is a non-existent symbol; gross = net because no fee module is deployed (§1).
 * - Platform fee "None during beta": §1, F41. Network gas "Paid by you ({gas token})": §1, F41.
 * - Tasks: Discord/Telegram bot-checked (§2 LIVE); "✓ checked by our bot" only when
 *   tasksEnforcedOnChain (CD-revisions §2.3, F29); X follow self-reported, dashed, never animates (§2, F33).
 * - Reward list: 4 generated (not real) addresses, 250 each, "1 left off by our app: missed a
 *   required task": §2 allocation list, F42 + RED-07.
 * - Ribbon: F43 wording (30 days counted from close, RED-22); the 14-day branch only when
 *   hostCloseGuarded (§3, F44).
 * - Footnotes: F45 as corrected; ② per tasksEnforcedOnChain.
 * - Tiers note: §2, F46. Explorer link: §4, address from the app config (D-X15). No "See a real
 *   one" link until an example campaign exists (C10).
 *
 * Phone (< 1024 px): a 5-row crop (escrowed · platform fee · list public 24 h · you close + 30
 * days · reclaim), the watermark band and no addresses; "Show the full statement" (a <details>)
 * reveals the rest. Without :has() support the full slip simply shows.
 */

// Generated display stubs, not real wallets (TRS F42).
const EXAMPLE_WALLETS = ['0x3f…a1', '0x9c…07', '0x51…e2', '0x7d…4b'] as const
const TICKER = 'EXAMPLE'

function Note({ n }: { n: string }) {
  return (
    <sup className="ml-1 font-mono text-[0.6875rem] font-medium text-ink-3" aria-hidden="true">
      {n}
    </sup>
  )
}

function Row({ label, value, notes, full, b }: { label: string; value: React.ReactNode; notes?: string; full?: boolean; b?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${full ? 'slip-full' : ''}`} data-b={b}>
      <dt className="text-small text-ink-2">{label}</dt>
      <dd className="text-right font-mono text-figure text-ink">
        {value}
        {notes && <Note n={notes} />}
      </dd>
    </div>
  )
}

export function StatementSlip() {
  const bot = claims.tasksEnforcedOnChain
  const testnetTag = `EXAMPLE · ${networkLabel.toUpperCase()}`
  const escrowUrl = explorerCodeUrl(network.entrypoint)

  return (
    <figure
      id="slip"
      aria-labelledby="slip-title"
      className="slip relative rounded bg-surface text-ink shadow-e2"
    >
      <div className="slip-perf" aria-hidden="true" />
      <div className="px-5 pb-5 pt-6 sm:px-7 sm:pb-7">
        {/* Header. The trace controls sit in the reserved space on the right. */}
        <div className="flex items-start justify-between gap-3 pr-[6.5rem]">
          <div>
            <p id="slip-title" className="font-mono text-eyebrow font-medium uppercase text-ink">
              Escrow statement
            </p>
            <p className="mt-1 text-small text-ink-2">Example campaign · Equal split · reward list</p>
          </div>
        </div>
        <SlipTrace stage={bot ? 5 : 4} />

        {/* The watermark band: this is an illustration, not a record. */}
        <p className="slip-watermark -mx-5 mt-4 overflow-hidden whitespace-nowrap bg-sunk py-1 text-center font-mono text-eyebrow font-medium uppercase text-ink-2 sm:-mx-7">
          {testnetTag}
        </p>

        <dl className="mt-2 divide-y divide-rule">
          <Row full label="Taken from your wallet" value={`1,000 ${TICKER}`} notes="①" />
          <Row label="Platform fee" value="None during beta" />
          <Row full label="Network gas" value={`Paid by you (${network.gasToken})`} />
          <div className="slip-total my-1 flex items-baseline justify-between gap-4 border-y-[3px] border-double border-ink py-2" data-b="total">
            <dt className="text-small font-semibold">Escrowed for rewards</dt>
            <dd className="text-right font-mono text-figure font-medium">
              1,000 {TICKER}
              <Note n="①" />
            </dd>
          </div>
          <div className="slip-full py-2">
            <dt className="text-small text-ink-2">
              Tasks{bot && <Note n="②" />}
            </dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {(['Join Discord', 'Join Telegram'] as const).map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded border border-ink-3 px-2 py-0.5 text-[0.8125rem] text-ink" data-b={bot ? 'tick' : undefined}>
                  {bot && <span aria-hidden="true">✓</span>}
                  {t}
                  {bot && <span className="text-ink-2"> · checked by our bot</span>}
                </span>
              ))}
              {/* Self-reported: dashed border AND the word (1.4.1); never animated. */}
              <span className="inline-flex items-center gap-1 rounded border border-dashed border-ink-3 px-2 py-0.5 text-[0.8125rem] text-ink">
                Follow on X <span className="text-ink-2">· self-reported</span>
              </span>
            </dd>
          </div>
          <div className="slip-full py-2">
            <dt className="text-small text-ink-2">
              Reward list
              {!bot && <Note n="②" />}
              <Note n="④" />
            </dt>
            <dd className="mt-1.5">
              <span className="flex flex-wrap gap-1.5">
                {EXAMPLE_WALLETS.map((w) => (
                  <span key={w} className="rounded bg-sunk px-1.5 py-0.5 font-mono text-[0.8125rem] text-ink" data-b="wallet">
                    {w}
                  </span>
                ))}
              </span>
              <span className="mt-1.5 block text-[0.8125rem] text-ink-2">
                250 each · 1 left off by our app: missed a required task
              </span>
            </dd>
          </div>
        </dl>

        {/* The lifecycle ribbon: an ordered list of text steps. The 24-hour stop is the only
            accent, and it has a text label, not just colour (A11 rule 6). */}
        <ol className="slip-ribbon mt-3 border-t border-rule pt-3 text-[0.8125rem] leading-snug" aria-label="What happens, in order">
          <li className="slip-full">Open</li>
          <li className="slip-full">Ends on schedule</li>
          <li className="relative font-medium text-signal" data-b="ring">
            <span className="slip-sweep" aria-hidden="true" />
            List public · 24 h
            <Note n="③" />
          </li>
          <li className="slip-full">Claims open</li>
          <li>
            You close it · 30 more days
            <Note n="⑤" />
          </li>
          <li className="relative font-medium" data-b="reclaim">
            <span className="slip-glow" aria-hidden="true" />
            You can reclaim what&apos;s left
          </li>
        </ol>
        {claims.hostCloseGuarded && (
          <p className="slip-full mt-1.5 border-l-2 border-rule pl-3 text-[0.8125rem] text-ink-2">
            No list within 14 days of the end? DappDrop can publish it (24 h still applies)
          </p>
        )}

        {/* Phone-only toggle for the rows above marked slip-full (CSS :has(), see globals.css). */}
        <details className="slip-toggle mt-3 lg:hidden">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-small font-medium lp-link">
            <span className="slip-show">Show the full statement</span>
            <span className="slip-hide">Show less</span>
          </summary>
        </details>

        <figcaption className="mt-3 border-t border-rule pt-3">
          <ol className="space-y-0.5 text-[0.8125rem] text-ink-2" aria-label="Notes">
            <li className="slip-full">
              <span className="font-mono" aria-hidden="true">① </span>
              In DappDrop, you fund the escrow before it opens.
            </li>
            <li className="slip-full">
              <span className="font-mono" aria-hidden="true">② </span>
              {bot ? 'Every task says how it’s checked.' : 'Our app builds the list; you review and publish it.'}
            </li>
            <li>
              <span className="font-mono" aria-hidden="true">③ </span>
              The reward list is public for 24 hours before claims open.
            </li>
            <li className="slip-full">
              <span className="font-mono" aria-hidden="true">④ </span>
              Each reward is bound to the wallet that earned it.
            </li>
            <li>
              <span className="font-mono" aria-hidden="true">⑤ </span>
              30 days after you close it, take back what&apos;s left.
            </li>
          </ol>
          <p className="slip-full mt-2 text-[0.8125rem] text-ink-2">On-chain tiers: computed by the contract, no list to check.</p>
          {escrowUrl && (
            <p className="mt-2 text-[0.8125rem]">
              <a
                href={escrowUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-link"
                data-dest="explorer_escrow"
                aria-label={`Escrow contract on ${network.explorerName}, verified source (opens in a new tab)`}
              >
                Escrow contract on {network.explorerName} ↗
              </a>{' '}
              <span className="text-ink-2">(verified source)</span>
            </p>
          )}
          {claims.exampleCampaign && escrowUrl && (
            <p className="mt-1 text-[0.8125rem]">
              <a
                href={`${network.explorer}/tx/${claims.exampleCampaign.fundingTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-link"
                data-dest="explorer_example"
                aria-label={`See a real example campaign's funding on ${network.explorerName} (opens in a new tab)`}
              >
                See a real one on {network.name} ↗
              </a>
            </p>
          )}
        </figcaption>
      </div>
    </figure>
  )
}
