import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { CampaignStatusInfo } from '@/lib/campaign-status'
import type { SettlementMode } from '@/lib/types'
import type { TaskVerificationMethod } from '@/lib/task-types'
import { payoutLabel, statusChip, VERIFICATION_CHIP, type ChipSpec, type ChipVariant } from './chip-map'

const VARIANT: Record<ChipVariant, string> = {
  neutral: 'border-rule-strong text-ink-2',
  open: 'border-ink-2 text-ink',
  ended: 'border-ink-3 text-ink-2',
  review: 'border-signal text-signal',
  claim: 'border-signal bg-signal font-medium text-on-signal',
  closed: 'border-rule-strong text-ink-3',
  draft: 'border-dashed border-ink-3 text-ink-2',
  cancelled: 'border-dashed border-rule-strong text-ink-3',
  check: 'border-ink-2 text-ink',
  self: 'border-dashed border-ink-3 text-ink-2',
  example: 'border-rule-strong text-[0.6875rem] uppercase tracking-[0.1em] text-ink-3',
  attention: 'border-ink text-ink',
  error: 'border-danger text-danger',
}

const MARK_TONE: Partial<Record<NonNullable<ChipSpec['mark']>, string>> = {
  '!': 'font-semibold text-signal',
  '✓': '',
}

/**
 * A chip: mono, 26 px, a pill outline. The state is always in the words; `mark` repeats it
 * (aria-hidden). Not a control: no pointer, no hover.
 *
 * `variant="error"` (the red) is for a failed transaction only; `claim` (the gold fill) for
 * claimable rewards only.
 */
export function Chip({
  variant = 'neutral',
  mark,
  children,
  className,
  title,
}: {
  variant?: ChipVariant
  mark?: ChipSpec['mark']
  children: ReactNode
  className?: string
  title?: string
}) {
  const markTone = variant === 'error' && mark === '!' ? 'font-semibold' : MARK_TONE[mark ?? '✓']
  return (
    <span
      className={cn(
        'inline-flex h-[1.625rem] max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border bg-transparent px-[0.65rem] font-mono text-[0.75rem] leading-none',
        VARIANT[variant],
        className,
      )}
      title={title}
      data-chip={variant}
    >
      {mark && (
        <span aria-hidden="true" className={cn(mark === '●' && 'text-[0.6rem]', markTone)}>
          {mark}
        </span>
      )}
      <span className="truncate">{children}</span>
    </span>
  )
}

/**
 * The campaign status chip, driven by `getCampaignStatus()` (src/lib/campaign-status.ts):
 *   <CampaignStatusChip status={getCampaignStatus(campaign)} />
 * `hostFundedDraft` shows a host "Draft · funded". `withDetail` adds the model's detail line as
 * the title (the page shows it in words elsewhere).
 */
export function CampaignStatusChip({
  status,
  hostFundedDraft,
  className,
}: {
  status: Pick<CampaignStatusInfo, 'state' | 'label' | 'detail'>
  hostFundedDraft?: boolean
  className?: string
}) {
  const chip = statusChip(status, { hostFundedDraft })
  return (
    <Chip variant={chip.variant} mark={chip.mark} className={className}>
      {chip.label}
    </Chip>
  )
}

/** "Equal split · reward list" / "Ranked · first 100" / "By points" / "One NFT each". Unknown → nothing. */
export function PayoutChip({ mode, rankedCount, className }: { mode: SettlementMode | undefined | null; rankedCount?: number; className?: string }) {
  const label = payoutLabel(mode, { rankedCount })
  if (!label) return null
  return (
    <Chip variant="neutral" className={className}>
      {label}
    </Chip>
  )
}

/**
 * How a task is checked (from TASK_VERIFICATION_METHOD in src/lib/task-types.ts):
 * "✓ Checked by our bot", "✓ Signed by your wallet", "✓ Checked on-chain", "✓ Verified-human
 * check", or a dashed "Self-reported" (+ "Not checked automatically yet" when `withNote`).
 */
export function VerificationChip({ method, withNote = false, className }: { method: TaskVerificationMethod; withNote?: boolean; className?: string }) {
  const spec = VERIFICATION_CHIP[method]
  const chip = (
    <Chip variant={spec.variant} mark={spec.mark} className={className}>
      {spec.label}
    </Chip>
  )
  if (!withNote || !spec.note) return chip
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {chip}
      <span className="text-[0.8125rem] text-ink-3">{spec.note}</span>
    </span>
  )
}

/** The "Example" tag on illustrative data (uppercase, quiet). */
export function ExampleChip({ className }: { className?: string }) {
  return (
    <Chip variant="example" className={className}>
      Example
    </Chip>
  )
}
