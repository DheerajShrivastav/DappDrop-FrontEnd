import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getCampaignStatus,
  matchesStatusFilter,
  shortDate,
  ROOT_DISPUTE_WINDOW_MS,
  CLAIM_GRACE_PERIOD_MS,
  SETTLEMENT_FALLBACK_DELAY_MS,
  type CampaignStatusInput,
} from './campaign-status'
import { getLifecycleState } from './campaign-lifecycle'

const H = 60 * 60 * 1000
const D = 24 * H
const NOW = new Date('2026-10-16T12:00:00Z')
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs)
const ROOT = '0x' + 'ab'.repeat(32)
const ZERO = '0x' + '00'.repeat(32)

function campaign(over: Partial<CampaignStatusInput> = {}): CampaignStatusInput {
  return {
    status: 'Open',
    startDate: at(-3 * D),
    endDate: at(3 * D),
    participants: 2,
    ...over,
  }
}

test('Draft and Cancelled ignore the clock', () => {
  assert.equal(getCampaignStatus(campaign({ status: 'Draft', endDate: at(-9 * D) }), NOW).state, 'draft')
  const c = getCampaignStatus(campaign({ status: 'Cancelled' }), NOW)
  assert.equal(c.state, 'cancelled')
  assert.equal(c.label, 'Cancelled')
})

test('Open on-chain before the start reads Upcoming and takes no tasks', () => {
  const s = getCampaignStatus(campaign({ startDate: at(2 * H), endDate: at(5 * D) }), NOW)
  assert.equal(s.state, 'upcoming')
  assert.equal(s.label, 'Upcoming')
  assert.equal(s.acceptingTasks, false)
})

test('Open on-chain inside the window reads Open and takes tasks', () => {
  const s = getCampaignStatus(campaign(), NOW)
  assert.equal(s.state, 'open')
  assert.equal(s.label, 'Open')
  assert.equal(s.acceptingTasks, true)
  assert.equal(s.claimable, false)
})

test('Open on-chain past the end time reads Ended (awaiting the end tx), never Open', () => {
  // Campaign #7 on production: ended 20 Sep, still Open on-chain on 16 Oct.
  const end = new Date('2026-09-20T14:00:00Z')
  const s = getCampaignStatus(campaign({ startDate: new Date('2026-09-10T00:00:00Z'), endDate: end }), NOW)
  assert.equal(s.state, 'ended_unrecorded')
  assert.equal(s.label, 'Ended')
  assert.notEqual(s.label, 'Open')
  assert.equal(s.acceptingTasks, false)
  assert.match(s.detail, new RegExp(`Ended ${shortDate(end)}`))
  assert.match(s.detail, /anyone can record it/)
})

test('the end time itself counts as ended', () => {
  assert.equal(getCampaignStatus(campaign({ endDate: NOW }), NOW).state, 'ended_unrecorded')
})

test('the default clock is the current time', () => {
  const past = getCampaignStatus(campaign({ startDate: new Date(Date.now() - 2 * D), endDate: new Date(Date.now() - D) }))
  assert.equal(past.state, 'ended_unrecorded')
})

test('Ended without a list: results next, then overdue after 14 days', () => {
  const s = { mode: 'MERKLE_ERC20' as const, erc20MerkleRoot: ZERO }
  const fresh = getCampaignStatus(campaign({ status: 'Ended', endDate: at(-2 * D), settlement: s }), NOW)
  assert.equal(fresh.state, 'ended_finalizing')
  assert.equal(fresh.label, 'Ended · results next')
  const overdue = getCampaignStatus(
    campaign({ status: 'Ended', endDate: at(-SETTLEMENT_FALLBACK_DELAY_MS - H), settlement: s }),
    NOW,
  )
  assert.equal(overdue.state, 'overdue_fallback')
  assert.equal(overdue.label, 'Ended · list overdue')
})

test('Ended with a list inside 24 h: List public; after 24 h: Claims open', () => {
  const inWindow = getCampaignStatus(
    campaign({ status: 'Ended', endDate: at(-2 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-2 * H) } }),
    NOW,
  )
  assert.equal(inWindow.state, 'allocations_published')
  assert.equal(inWindow.label, 'List public · 24 h')
  assert.equal(inWindow.inDisputeWindow, true)
  assert.equal(inWindow.claimable, false)
  assert.equal(inWindow.claimsOpenAt?.getTime(), at(-2 * H + ROOT_DISPUTE_WINDOW_MS).getTime())

  const open = getCampaignStatus(
    campaign({ status: 'Ended', endDate: at(-3 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-25 * H) } }),
    NOW,
  )
  assert.equal(open.state, 'claims_open')
  assert.equal(open.claimable, true)
})

test('NFT campaigns read the NFT root', () => {
  const s = getCampaignStatus(
    campaign({ status: 'Ended', endDate: at(-3 * D), settlement: { mode: 'NFT', nftMerkleRoot: ROOT, nftRootPublishedAt: at(-30 * H) } }),
    NOW,
  )
  assert.equal(s.state, 'claims_open')
})

test('tiered campaigns open claims straight at Ended (no list, no 24 h)', () => {
  for (const mode of ['RANK_TIERED', 'SCORE_TIERED'] as const) {
    const s = getCampaignStatus(campaign({ status: 'Ended', endDate: at(-D), settlement: { mode } }), NOW)
    assert.equal(s.state, 'claims_open')
    assert.equal(s.claimable, true)
  }
})

test('Closed: claim-by date, nobody-qualified, and swept', () => {
  const closedAt = at(-2 * D)
  const claimable = getCampaignStatus(
    campaign({ status: 'Closed', endDate: at(-5 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-4 * D), closedAt } }),
    NOW,
  )
  assert.equal(claimable.state, 'closed_claimable')
  assert.equal(claimable.label, `Claim by ${shortDate(new Date(closedAt.getTime() + CLAIM_GRACE_PERIOD_MS))}`)

  const nobody = getCampaignStatus(campaign({ status: 'Closed', participants: 0, endDate: at(-5 * D) }), NOW)
  assert.equal(nobody.state, 'closed_no_claimants')
  assert.equal(nobody.label, 'Closed')

  const noRoot = getCampaignStatus(
    campaign({ status: 'Closed', endDate: at(-5 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: null } }),
    NOW,
  )
  assert.equal(noRoot.state, 'closed_no_claimants')

  // Settlement facts not loaded (indexer down): don't claim nobody qualified.
  const unknown = getCampaignStatus(campaign({ status: 'Closed', endDate: at(-5 * D) }), NOW)
  assert.equal(unknown.state, 'closed_claimable')
  assert.equal(unknown.label, 'Closed · claims open')

  const swept = getCampaignStatus(
    campaign({ status: 'Closed', endDate: at(-50 * D), settlement: { mode: 'MERKLE_ERC20', erc20Swept: true } }),
    NOW,
  )
  assert.equal(swept.state, 'swept')
  assert.equal(swept.label, 'Claiming ended')
})

test('getLifecycleState is the same function (no second source of truth)', () => {
  const c = campaign({ endDate: at(-D) })
  assert.deepEqual(getLifecycleState(c, NOW), getCampaignStatus(c, NOW))
})

test('the Open filter excludes ended-but-unrecorded campaigns', () => {
  assert.equal(matchesStatusFilter('open', 'open'), true)
  assert.equal(matchesStatusFilter('ended_unrecorded', 'open'), false)
  assert.equal(matchesStatusFilter('upcoming', 'open'), false)
  assert.equal(matchesStatusFilter('allocations_published', 'claimable'), true)
  assert.equal(matchesStatusFilter('closed_claimable', 'claimable'), true)
  assert.equal(matchesStatusFilter('cancelled', 'closed'), true)
  assert.equal(matchesStatusFilter('ended_unrecorded', 'all'), true)
})
