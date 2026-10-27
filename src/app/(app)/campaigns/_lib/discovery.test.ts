import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Campaign } from '@/lib/types'
import type { CampaignDisplayState } from '@/lib/campaign-status'
import { getCampaignStatus } from '@/lib/campaign-status'
import { DEFAULT_FILTERS, applyDiscoveryFilters, bucketOf, filtersActive, participantsFact, rewardFact, taskCheckSummary, timeFact } from './discovery'

const H = 60 * 60 * 1000
const D = 24 * H
const NOW = new Date('2026-10-16T12:00:00Z')
const at = (ms: number) => new Date(NOW.getTime() + ms)
const ROOT = '0x' + 'ab'.repeat(32)

function c(id: string, over: Partial<Campaign> = {}): Campaign {
  return {
    id,
    title: `Example ${id}`,
    description: '',
    longDescription: '',
    startDate: at(-3 * D),
    endDate: at(3 * D),
    status: 'Open',
    participants: 1,
    host: '0x7a1c000000000000000000000000000000009c03',
    tasks: [],
    reward: { type: 'ERC20', tokenAddress: '', name: '' },
    settlement: { mode: 'MERKLE_ERC20' },
    imageUrl: '',
    ...over,
  }
}

test('every display state lands in at most one bucket; drafts and upcoming only under All', () => {
  const states: CampaignDisplayState[] = [
    'draft', 'upcoming', 'open', 'ended_unrecorded', 'ended_finalizing', 'overdue_fallback',
    'allocations_published', 'claims_open', 'closed_claimable', 'closed_no_claimants', 'swept', 'cancelled',
  ]
  const got = Object.fromEntries(states.map((s) => [s, bucketOf(s)]))
  assert.deepEqual(got, {
    draft: null,
    upcoming: null,
    open: 'open',
    ended_unrecorded: 'ended',
    ended_finalizing: 'ended',
    overdue_fallback: 'ended',
    allocations_published: 'claims',
    claims_open: 'claims',
    closed_claimable: 'claims',
    closed_no_claimants: 'closed',
    swept: 'closed',
    cancelled: 'closed',
  })
})

test('an Open campaign past its end time counts as Ended, not Open (APP-06)', () => {
  const list = [c('1'), c('2', { endDate: at(-2 * D) })]
  const { counts, results } = applyDiscoveryFilters(list, { ...DEFAULT_FILTERS, status: 'open' }, NOW)
  assert.deepEqual(counts, { all: 2, open: 1, claims: 0, ended: 1, closed: 0 })
  assert.deepEqual(results.map((r) => r.id), ['1'])
})

test('counts follow search / reward / payout, so a count always matches what clicking shows', () => {
  const list = [
    c('1', { title: 'Docs sprint' }),
    c('2', { title: 'Docs week', status: 'Ended', endDate: at(-5 * D), settlement: { mode: 'RANK_TIERED' } }),
    c('3', { title: 'Genesis badge', reward: { type: 'ERC721', tokenAddress: '', name: '' }, settlement: { mode: 'NFT' } }),
  ]
  const docs = applyDiscoveryFilters(list, { ...DEFAULT_FILTERS, search: 'docs' }, NOW)
  assert.deepEqual(docs.counts, { all: 2, open: 1, claims: 1, ended: 0, closed: 0 })
  const nfts = applyDiscoveryFilters(list, { ...DEFAULT_FILTERS, reward: 'nfts' }, NOW)
  assert.deepEqual(nfts.results.map((r) => r.id), ['3'])
  const ranked = applyDiscoveryFilters(list, { ...DEFAULT_FILTERS, payout: 'RANK_TIERED' }, NOW)
  assert.deepEqual(ranked.results.map((r) => r.id), ['2'])
  assert.equal(filtersActive(DEFAULT_FILTERS), false)
  assert.equal(filtersActive({ ...DEFAULT_FILTERS, sort: 'ending_soon' }), false)
  assert.equal(filtersActive({ ...DEFAULT_FILTERS, search: ' x ' }), true)
})

test('sorts: newest (latest end first), ending soon, most participants', () => {
  const list = [c('a', { endDate: at(1 * D), participants: 5 }), c('b', { endDate: at(4 * D), participants: 9 }), c('c', { endDate: at(2 * D), participants: 1 })]
  const ids = (sort: typeof DEFAULT_FILTERS.sort) => applyDiscoveryFilters(list, { ...DEFAULT_FILTERS, sort }, NOW).results.map((r) => r.id)
  assert.deepEqual(ids('newest'), ['b', 'c', 'a'])
  assert.deepEqual(ids('ending_soon'), ['a', 'c', 'b'])
  assert.deepEqual(ids('most_participants'), ['b', 'a', 'c'])
})

test('the time row follows the state', () => {
  const open = c('1', { endDate: at(3 * D + 2 * H) })
  assert.deepEqual(timeFact(open, getCampaignStatus(open, NOW), NOW).label, 'Ends')
  assert.match(timeFact(open, getCampaignStatus(open, NOW), NOW).value, /^in 3 days · \d+ Oct$/)

  const review = c('2', { status: 'Ended', endDate: at(-2 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-2 * H) } })
  assert.equal(timeFact(review, getCampaignStatus(review, NOW), NOW).label, 'Claims open')

  const closed = c('3', { status: 'Closed', endDate: at(-9 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, closedAt: at(-1 * D) } })
  const t = timeFact(closed, getCampaignStatus(closed, NOW), NOW)
  assert.equal(t.label, 'Claim by')

  const ended = c('4', { endDate: at(-1 * D) })
  assert.equal(timeFact(ended, getCampaignStatus(ended, NOW), NOW).label, 'Ended')
})

test('the reward row never invents a reward', () => {
  assert.deepEqual(rewardFact(c('1', { reward: { type: 'ERC20', tokenAddress: '', name: '1,000 EXAMPLE' } })), { label: 'Reward pool', value: '1,000 EXAMPLE' })
  assert.deepEqual(rewardFact(c('2')), { label: 'Reward pool', value: 'Not available' })
  assert.deepEqual(rewardFact(c('3', { settlement: { mode: 'UNSET' } })), { label: 'Reward pool', value: 'Not set yet' })
  assert.equal(rewardFact(c('4', { settlement: { mode: 'NFT' } })).label, 'Reward')
})

test('participants show the real cap; tasks summarise how they are checked', () => {
  assert.equal(participantsFact(c('1', { participants: 38, settlement: { mode: 'MERKLE_ERC20', maxParticipants: 500 } })), '38 of 500')
  assert.equal(participantsFact(c('2', { participants: 1200 })), '1,200')
  const tasks = [
    { id: '1', type: 'SOCIAL_FOLLOW', description: '' },
    { id: '2', type: 'JOIN_DISCORD', description: '' },
    { id: '3', type: 'HUMANITY_VERIFICATION', description: '' },
  ] as Campaign['tasks']
  assert.equal(taskCheckSummary({ tasks }), '2 checked · 1 self-reported')
  assert.equal(taskCheckSummary({ tasks: [] }), '')
})
