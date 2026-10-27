import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCampaignStatus, type CampaignDisplayState } from '@/lib/campaign-status'
import { STATUS_CHIP, payoutLabel, statusChip, VERIFICATION_CHIP } from './chip-map'

const STATES: CampaignDisplayState[] = [
  'draft',
  'upcoming',
  'open',
  'ended_unrecorded',
  'ended_finalizing',
  'overdue_fallback',
  'allocations_published',
  'claims_open',
  'closed_claimable',
  'closed_no_claimants',
  'swept',
  'cancelled',
]

test('every display state has a chip, and only claimable states are the gold fill', () => {
  assert.deepEqual(Object.keys(STATUS_CHIP).sort(), [...STATES].sort())
  const gold = STATES.filter((s) => STATUS_CHIP[s].variant === 'claim')
  assert.deepEqual(gold.sort(), ['claims_open', 'closed_claimable'])
  // The red is for failed transactions only: no lifecycle state may use it.
  assert.equal(STATES.some((s) => STATUS_CHIP[s].variant === 'error'), false)
})

test('chip words come from the status model, so the chip and the page never disagree', () => {
  const now = new Date('2026-10-16T12:00:00Z')
  const info = getCampaignStatus({ status: 'Open', startDate: new Date('2026-09-10'), endDate: new Date('2026-09-20'), participants: 3 }, now)
  assert.deepEqual(statusChip(info), { variant: 'ended', mark: '◷', label: info.label })
  assert.equal(statusChip({ state: 'cancelled', label: 'Cancelled' }).label, 'Cancelled · refunded')
  assert.equal(statusChip({ state: 'draft', label: 'Draft' }, { hostFundedDraft: true }).label, 'Draft · funded')
})

test('payout labels drop the jargon, and unknown means no chip (never "TBD")', () => {
  assert.equal(payoutLabel('MERKLE_ERC20'), 'Equal split · reward list')
  assert.equal(payoutLabel('RANK_TIERED', { rankedCount: 100 }), 'Ranked · first 100')
  assert.equal(payoutLabel('SCORE_TIERED'), 'By points')
  assert.equal(payoutLabel('NFT'), 'One NFT each')
  assert.equal(payoutLabel(undefined), null)
})

test('self-reported tasks are dashed and say so; real checks carry a tick', () => {
  assert.equal(VERIFICATION_CHIP['self-reported'].variant, 'self')
  assert.equal(VERIFICATION_CHIP['self-reported'].mark, undefined)
  for (const k of ['bot-membership', 'siwe-session', 'payment', 'contract', 'humanity'] as const) {
    assert.equal(VERIFICATION_CHIP[k].mark, '✓')
  }
})
