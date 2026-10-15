import { claims } from '@/config/claims'
import { Receipt } from './receipt'
import { PhoneDetails } from './phone-details'
import { Section } from './section'
import { StatusChip, type ChipKind } from './status-chip'

/**
 * S1-11: #verification, "Every task says how it's checked" (plan §2.5; TRS F29–F39; RED-02/15).
 * Rows ordered by strength: the contract → our bot → our app → the wallet → self-reported.
 * Flag paths:
 * - tasksEnforcedOnChain → "Membership checked by our bot" + "Only our verifier or the contract
 *   itself can mark a task complete." with a receipt (S2-02); otherwise the F29 disclosure.
 * - tierModuleFixed (with tasksEnforcedOnChain) → the tiered Humanity wording (V13, S2-03).
 * - humanityNaming → "Humanity Protocol sign-in" (C12); paymentTaskChainLocked → the payment row.
 */
type Row = { task: string; how: React.ReactNode; chips: [ChipKind, string][] }

export function TaskMatrix() {
  const s2 = claims.tasksEnforcedOnChain
  const tiered = claims.tasksEnforcedOnChain && claims.tierModuleFixed
  const human = claims.humanityNaming ? 'Humanity Protocol sign-in' : 'A verified-human check'

  const rows: Row[] = [
    { task: 'Hold a token or NFT', how: 'Checked by the contract itself.', chips: [['planned', 'In the contracts; not yet in the wizard']] },
    {
      task: 'Join a Discord server',
      how: s2 ? 'Membership checked by our bot.' : 'Our bot checks membership in the app.',
      chips: [['checked', 'Live'], ['review', 'Linking Discord to a wallet: in review']],
    },
    {
      task: 'Join a Telegram group',
      how: s2 ? 'Membership checked by our bot.' : 'Our bot checks membership in the app.',
      chips: [['checked', 'Live'], ['review', 'Linked accounts: in review']],
    },
    {
      task: 'Verified human',
      how: (
        <>
          {human}. Applied by our app when it builds the list, for reward-list campaigns with “Humanity-verified wallets only” on.
          {tiered && ' For tiered campaigns, it’s a required task the contract enforces.'}
        </>
      ),
      chips: [['checked', 'Live']],
    },
    { task: 'Connect a wallet', how: 'Proven by a wallet sign-in signature.', chips: [['checked', 'Live']] },
    ...(claims.paymentTaskChainLocked
      ? [
          {
            task: 'Make a payment',
            how: 'A set amount to a set address, verified on-chain as coming from the participant’s own wallet.',
            chips: [['checked', 'Live']] as [ChipKind, string][],
          },
        ]
      : []),
    { task: 'Post on X', how: 'The participant posts a unique code; we check the post.', chips: [['review', 'In review']] },
    {
      task: 'Follow, like or repost on X',
      how: (
        <>
          <strong className="font-semibold text-ink">Self-reported.</strong> We label it that way in the app.
        </>
      ),
      chips: [['self', 'Live · self-reported']],
    },
  ]

  return (
    <Section
      id="tasks"
      track="tasks"
      eyebrow="Tasks"
      title="Every task says how it’s checked."
      dek="By our bot, by our app, by the chain, or self-reported. We label each one, so you know what you’re rewarding."
    >
      <ul className="mt-6 border-b border-rule md:mt-8" aria-label="Task types, strongest check first">
        {rows.map((r) => (
          <li key={r.task} className="border-t border-rule">
            {/* Founder decision 2026-10-11: below 768 px each row is the task + its chip; how it's
                checked is one tap away. Expanded from 768 px. */}
            <PhoneDetails
              detail={`task_${r.task.toLowerCase().replace(/[^a-z]+/g, '_')}`}
              summaryClassName="py-1.5 md:py-2"
              summary={
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-small font-semibold md:text-body">{r.task}</span>
                  <StatusChip kind={r.chips[0][0]}>{r.chips[0][1]}</StatusChip>
                </span>
              }
            >
              <p className="max-w-[48rem] pb-3 text-small text-ink-2">
                {r.how}
                {r.chips[1] && <span> {r.chips[1][1]}.</span>}
              </p>
            </PhoneDetails>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-2 text-small text-ink-2 md:text-body">
          <p>
            Task results from our checks are signed and recorded on-chain for each wallet.{' '}
            {s2 ? (
              <>
                Only our verifier or the contract itself can mark a task complete. <Receipt id="tasks" />
              </>
            ) : (
              <strong className="font-semibold text-ink">
                Until our next contract update, participants can also mark these tasks complete directly on the contract. The update
                removes that.
              </strong>
            )}
          </p>
        </div>
        <div className="hidden rounded-lg border border-rule bg-surface p-5 md:block">
          <h3 className="text-small font-semibold md:text-body">Will bots farm my budget?</h3>
          <p className="mt-1.5 text-small text-ink-2">
            No tool stops every bot. For reward-list campaigns, turn on “Humanity-verified wallets only” and unverified wallets are
            left off the reward list.
            {tiered && ' For tiered campaigns, it adds a required verified-human task that the contract enforces.'} Optional.{' '}
            <Receipt id="humanityFilter" />
          </p>
        </div>
      </div>
    </Section>
  )
}
