import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCampaignStatus, type CampaignDisplayState, type CampaignStatusInput } from '@/lib/campaign-status'
import { dateRange, hostPlan, ribbonStops } from './campaign-model'

const D = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-16T12:00:00Z')
const at = (ms: number) => new Date(NOW.getTime() + ms)
const ROOT = '0x' + 'ab'.repeat(32)
const ZERO = '0x' + '00'.repeat(32)
const base: CampaignStatusInput = { status: 'Open', startDate: at(-3 * D), endDate: at(3 * D), participants: 11 }

// One example per display state (list campaign), mirroring the primitives gallery.
const CASES: [CampaignDisplayState, CampaignStatusInput][] = [
  ['draft', { ...base, status: 'Draft' }],
  ['upcoming', { ...base, startDate: at(2 * D), endDate: at(9 * D) }],
  ['open', base],
  ['ended_unrecorded', { ...base, startDate: at(-20 * D), endDate: at(-2 * D) }],
  ['ended_finalizing', { ...base, status: 'Ended', endDate: at(-2 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ZERO } }],
  ['overdue_fallback', { ...base, status: 'Ended', endDate: at(-20 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ZERO } }],
  ['allocations_published', { ...base, status: 'Ended', endDate: at(-2 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-6 * 60 * 60 * 1000) } }],
  ['claims_open', { ...base, status: 'Ended', endDate: at(-3 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-2 * D) } }],
  ['closed_claimable', { ...base, status: 'Closed', endDate: at(-9 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-8 * D), closedAt: at(-1 * D) } }],
  ['closed_no_claimants', { ...base, status: 'Closed', participants: 0, endDate: at(-9 * D), settlement: { mode: 'MERKLE_ERC20', closedAt: at(-1 * D) } }],
  ['swept', { ...base, status: 'Closed', endDate: at(-60 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20Swept: true } }],
  ['cancelled', { ...base, status: 'Cancelled' }],
]

test('the cases cover every display state', () => {
  for (const [state, input] of CASES) assert.equal(getCampaignStatus(input, NOW).state, state)
})

test('ribbon: exactly one stop is "now", and it moves forward with the lifecycle', () => {
  let last = -1
  for (const [state, input] of CASES) {
    const stops = ribbonStops(input, getCampaignStatus(input, NOW))
    assert.equal(stops.filter((s) => s.state === 'now').length, 1, state)
    if (state === 'cancelled') continue
    assert.equal(stops.length, 6, state)
    const i = stops.findIndex((s) => s.state === 'now')
    assert.ok(i >= last, `${state} goes backwards`)
    last = i
    // Everything before "now" is past; everything after is later.
    stops.forEach((s, j) => assert.equal(s.state, j < i ? 'past' : j === i ? 'now' : 'later'))
  }
})

test('ribbon: the open stop says when it ends; the 24 h stop is current inside the review', () => {
  const open = ribbonStops(base, getCampaignStatus(base, NOW))
  assert.match(open.find((s) => s.state === 'now')!.label, /^Open · ends \d+ \w+$/)
  const review = CASES.find(([s]) => s === 'allocations_published')![1]
  assert.equal(ribbonStops(review, getCampaignStatus(review, NOW)).find((s) => s.state === 'now')!.label, 'List public · 24 h')
})

test('ribbon: ranked and by-points campaigns have no list stop', () => {
  const tiered: CampaignStatusInput = { ...base, status: 'Ended', endDate: at(-1 * D), settlement: { mode: 'RANK_TIERED' } }
  const stops = ribbonStops(tiered, getCampaignStatus(tiered, NOW))
  assert.equal(stops.length, 5)
  assert.ok(!stops.some((s) => /List/.test(s.label)))
  assert.equal(stops.find((s) => s.state === 'now')!.label, 'Claims open')
})

test('host plan: the current step follows the state; the close guard holds only with participants and no list', () => {
  const expectNow: Partial<Record<CampaignDisplayState, string | null>> = {
    draft: 'opened',
    open: 'ended',
    ended_unrecorded: 'ended',
    ended_finalizing: 'list',
    overdue_fallback: 'list',
    allocations_published: 'review',
    claims_open: 'close',
    closed_claimable: 'reclaim',
    swept: null,
  }
  for (const [state, input] of CASES) {
    if (!(state in expectNow)) continue
    const plan = hostPlan(input, getCampaignStatus(input, NOW))
    const now = plan.steps.find((s) => s.state === 'now')
    assert.equal(now?.key ?? null, expectNow[state], state)
    assert.equal(plan.steps.length, 7)
    assert.equal(plan.closeBlocked, state === 'ended_finalizing' || state === 'overdue_fallback', state)
  }
  // Nobody joined: closing is allowed (the dialog offers "Cancel campaign instead").
  const empty = { ...CASES.find(([s]) => s === 'ended_finalizing')![1], participants: 0 }
  assert.equal(hostPlan(empty, getCampaignStatus(empty, NOW)).closeBlocked, false)
})

test('host plan: tiered campaigns skip the list and review steps and are never close-guarded', () => {
  const tiered: CampaignStatusInput = { ...base, status: 'Ended', endDate: at(-1 * D), settlement: { mode: 'SCORE_TIERED' } }
  const plan = hostPlan(tiered, getCampaignStatus(tiered, NOW))
  assert.deepEqual(plan.steps.map((s) => s.key), ['created', 'opened', 'ended', 'close', 'reclaim'])
  assert.equal(plan.steps.find((s) => s.state === 'now')!.key, 'close')
  assert.equal(plan.closeBlocked, false)
  assert.equal(plan.currentIndex, 4)
})

test('host plan: the host bar never invents a deadline', () => {
  const finalizing = CASES.find(([s]) => s === 'ended_finalizing')![1]
  assert.match(hostPlan(finalizing, getCampaignStatus(finalizing, NOW)).needsYou, /^One thing needs you: publish the reward list by \d+ \w+\.$/)
  const swept = CASES.find(([s]) => s === 'swept')![1]
  assert.equal(hostPlan(swept, getCampaignStatus(swept, NOW)).currentIndex, null)
})

test('date ranges read like the mockups', () => {
  assert.equal(dateRange(new Date(2026, 7, 7, 9), new Date(2026, 7, 7, 18)), '7 Aug')
  assert.equal(dateRange(new Date(2026, 9, 1), new Date(2026, 9, 8)), '1–8 Oct')
  assert.equal(dateRange(new Date(2026, 8, 28), new Date(2026, 9, 8)), '28 Sep – 8 Oct')
  assert.equal(dateRange(new Date(2026, 11, 28), new Date(2027, 0, 3)), '28 Dec 2026 – 3 Jan 2027')
})

test('host plan: with settlement facts loaded, the close guard follows the contract (SettlementNotPublished)', () => {
  const MOD = '0x' + '11'.repeat(20)
  const ended = (settlement: CampaignStatusInput['settlement'], participants = 5): CampaignStatusInput => ({
    ...base,
    status: 'Ended',
    endDate: at(-1 * D),
    participants,
    settlement,
  })
  const blocked = (c: CampaignStatusInput) => hostPlan(c, getCampaignStatus(c, NOW)).closeBlocked
  // Escrowed tokens, no list: the contract refuses close.
  assert.equal(blocked(ended({ mode: 'UNSET', erc20EscrowedNet: '1000', erc20MerkleRoot: null })), true)
  // Nothing escrowed (an off-chain reward): the contract lets the host close, so the UI does too.
  assert.equal(blocked(ended({ mode: 'UNSET', erc20EscrowedNet: '0', erc20MerkleRoot: null })), false)
  // Deposited NFTs with a published root: not blocked; without one: blocked.
  assert.equal(blocked(ended({ mode: 'NFT', nftModule: MOD, nftMerkleRoot: '0x' + 'ab'.repeat(32), erc20EscrowedNet: '0' })), false)
  assert.equal(blocked(ended({ mode: 'NFT', nftModule: MOD, nftMerkleRoot: null, erc20EscrowedNet: '0' })), true)
  // Nobody joined: the button stays live so the dialog can offer "Cancel campaign instead".
  assert.equal(blocked(ended({ mode: 'UNSET', erc20EscrowedNet: '1000', erc20MerkleRoot: null }, 0)), false)
})
