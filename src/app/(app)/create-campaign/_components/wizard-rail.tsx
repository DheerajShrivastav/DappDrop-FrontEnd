'use client'

import { KeyValueList, Panel, type KeyValueItem } from '@/components/app'

/**
 * The wizard's right rail (app-design §1.10): "Your campaign so far" and "What you'll pay". On
 * a phone it folds into a "Summary" disclosure above the nav buttons (WizardRailDisclosure).
 */
export type RailProps = { soFar?: KeyValueItem[]; pay: KeyValueItem[]; payNote?: string | null; feeCapNote?: boolean }

export function RailPanels({ soFar, pay, payNote, feeCapNote }: RailProps) {
  return (
    <>
      {soFar && (
        <Panel eyebrow="Your campaign so far">
          <KeyValueList items={soFar} />
        </Panel>
      )}
      <Panel eyebrow="What you’ll pay">
        <KeyValueList items={pay} />
        {payNote && <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-2">{payNote}</p>}
        {/* TODO(redeploy): the 10% fee cap ships with the contract update (app-design §3.3).
            Turn this on (FEE_CAP_SHIPPED) only once the redeployed Web3Campaigns enforces it. */}
        {feeCapNote && (
          <div className="relative mt-7 rounded-md border border-dashed border-signal px-4 pb-3 pt-4">
            <span className="absolute -top-2.5 right-3 bg-surface px-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-signal">Contract update</span>
            <p className="text-[0.8125rem] leading-relaxed text-ink-2">The contract caps any platform fee at 10%. It’s shown on Review before you sign.</p>
          </div>
        )}
      </Panel>
    </>
  )
}

export function WizardRail(props: RailProps) {
  return (
    <aside aria-label="Summary" className="hidden content-start gap-4 lg:sticky lg:top-6 lg:grid">
      <RailPanels {...props} />
    </aside>
  )
}

export function WizardRailDisclosure(props: RailProps) {
  return (
    <details className="group rounded-[10px] border border-rule lg:hidden" data-rail-disclosure>
      <summary className="flex min-h-12 cursor-pointer items-center justify-between px-5 text-[0.9375rem] font-semibold text-ink">
        Summary
        <span aria-hidden="true" className="font-mono text-[0.75rem] font-normal text-ink-3">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="grid gap-4 border-t border-rule p-3">
        <RailPanels {...props} />
      </div>
    </details>
  )
}
