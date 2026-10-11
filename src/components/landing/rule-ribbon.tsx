import { claims } from '@/config/claims'
import { PhoneDetails } from './phone-details'
import { Receipt } from './receipt'
import type { ReceiptId } from '@/config/receipts'

/**
 * S1-08 block 3: the money rules as numbered lifecycle stops (R1–R7), an <ol> on the sunk band,
 * vertical on phone. The 24-hour stop has a text label and the only accent (A11 rule 6).
 * Receipts attach inline to their stop (PRF phone-height fix). Flag paths:
 * - tieredCancelLive → R2 loses the tiered chip (S2-03);
 * - keeperLive → R3 adds "It ends on schedule, automatically." (D-X7);
 * - hostCloseGuarded → R5 drops "unless the host has already closed", R5/R6 get receipts (S2-05).
 */
type Stop = {
  n: string
  when: string
  /** The one-line rule: always visible (it's the <summary> on phone). */
  rule: React.ReactNode
  /** The rest of the stop: behind the tap below 768 px (founder decision 2026-10-11). */
  more?: React.ReactNode
  receipt: ReceiptId
  accent?: boolean
  chip?: string | null
}

export function RuleRibbon() {
  const stops: Stop[] = [
    { n: 'R1', when: 'Before it opens', rule: <>Cap participation at up to 100,000 wallets.</>, receipt: 'R1' },
    {
      n: 'R2',
      when: 'Nobody joined?',
      rule: <>Cancel and get your reward back right away.</>,
      receipt: 'R2',
      chip: claims.tieredCancelLive ? null : 'Tiered campaigns: after the next contract update',
    },
    {
      n: 'R3',
      when: 'Once it’s running',
      rule: (
        <>
          Once anyone has joined, nobody can end it early, including you.
          {claims.keeperLive && <> It ends on schedule, automatically.</>}
        </>
      ),
      receipt: 'R3',
    },
    {
      n: 'R4',
      when: 'The list · 24 h public review',
      accent: true,
      rule: <strong className="block font-display text-[1.1875rem] font-normal leading-snug text-ink md:text-[1.375rem]">24 hours to check the list. Then claims open.</strong>,
      more: (
        <>
          Your community can spot a mistake, and you can fix it, before any money moves. Publish a corrected list and the 24 hours
          restart. It&apos;s a review window, not a veto: your community can flag a problem, and only you can change the list.
        </>
      ),
      receipt: 'R4',
    },
    {
      n: 'R5',
      when: 'Host gone quiet?',
      rule: claims.hostCloseGuarded ? (
        <>If the list isn&apos;t published within 14 days of the end, DappDrop can publish it as a fallback.</>
      ) : (
        <>
          If the list isn&apos;t published within 14 days of the end, DappDrop can publish it as a fallback, unless the host has
          already closed the campaign.
        </>
      ),
      more: <>The 24 hours still apply.</>,
      receipt: 'R5',
    },
    {
      n: 'R6',
      when: 'After you close',
      rule: <>Once you close the campaign, participants have 30 days to claim. Then you can take back whatever&apos;s left.</>,
      receipt: 'R6',
    },
    {
      n: 'R7',
      when: 'Pinned',
      rule: <>A campaign&apos;s payout module is pinned once it&apos;s set; it can&apos;t be swapped mid-campaign.</>,
      receipt: 'R7',
    },
  ]

  return (
    <div className="bg-sunk" id="rules">
      <div className="lp-container py-8 md:py-12">
        <h3 className="text-title font-semibold">The rules, stop by stop</h3>
        <p className="mt-1 font-mono text-[0.75rem] uppercase tracking-[0.06em] text-ink-2">For reward-list campaigns</p>
        <p className="mt-2 max-w-[40rem] text-small text-ink-2">
          For your engineer: each “Check ↗” opens the code that enforces the rule.
        </p>
        <ol className="mt-4 grid gap-x-6 gap-y-0 md:grid-cols-2 lg:grid-cols-4" aria-label="Rules R1 to R7">
          {stops.map((s) => (
            <li
              key={s.n}
              id={`rule-${s.n.toLowerCase()}`}
              className={`border-t-2 md:py-3 ${s.accent ? 'border-signal md:col-span-2' : 'border-ink-3'}`}
            >
              {/* Founder decision 2026-10-11: below 768 px each stop shows its label and one-line
                  rule; the rest (detail, chip, receipt) is one tap away. Expanded from 768 px. */}
              <PhoneDetails
                detail={`rule_${s.n}`}
                summary={
                  <>
                    <span className={`block font-mono text-[0.75rem] font-medium uppercase tracking-[0.06em] ${s.accent ? 'text-signal' : 'text-ink-2'}`}>
                      {s.n} · {s.when}
                    </span>
                    <span className="mt-0.5 block text-small text-ink">{s.rule}</span>
                  </>
                }
                summaryClassName="py-1.5"
              >
                <div className="pb-2 text-small text-ink">
                  {s.more && <p>{s.more}</p>}
                  {s.chip && (
                    <p className="mt-2 inline-flex rounded-full border border-ink-3 px-2.5 py-0.5 font-mono text-[0.75rem] text-ink-2">
                      {s.chip}
                    </p>
                  )}
                  <p className={s.more || s.chip ? 'mt-1' : ''}>
                    <Receipt id={s.receipt} />
                  </p>
                </div>
              </PhoneDetails>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-small text-ink-2">Ranked payouts have no list and no 24-hour window: the contract computes them.</p>
      </div>
    </div>
  )
}
