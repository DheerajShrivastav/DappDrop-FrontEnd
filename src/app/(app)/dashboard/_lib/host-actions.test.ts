import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Campaign } from '@/lib/types'
import { getCampaignStatus, CLAIM_GRACE_PERIOD_MS } from '@/lib/campaign-status'
import { dateRange, hostCsv, hostNext, hostRows, hostStats, isFundedDraft } from './host-actions'

const D = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-16T12:00:00Z')
const at = (ms: number) => new Date(NOW.getTime() + ms)
const ROOT = '0x' + 'ab'.repeat(32)

function c(id: string, over: Partial<Campaign> = {}): Campaign {
  return {
    id, title: `Example ${id}`, description: '', longDescription: '',
    startDate: at(-3 * D), endDate: at(3 * D), status: 'Open', participants: 4,
    host: '0x7a1c000000000000000000000000000000009c03', tasks: [],
    reward: { type: 'ERC20', tokenAddress: '', name: '' }, settlement: { mode: 'MERKLE_ERC20' }, imageUrl: '',
    ...over,
  }
}
const next = (x: Campaign) => hostNext(x, getCampaignStatus(x, NOW), NOW)

test('only the states that need the host land in "Needs you"', () => {
  assert.equal(next(c('open')).needsYou, undefined)
  assert.equal(next(c('open')).next, 'Ends on schedule')
  assert.equal(next(c('draft', { status: 'Draft' })).needsYou?.action, 'Review and open')
  assert.equal(next(c('unrec', { endDate: at(-1 * D) })).needsYou?.action, 'Record the end')
  const fin = next(c('fin', { status: 'Ended', endDate: at(-2 * D) }))
  assert.equal(fin.needsYou?.action, 'Propose the list')
  assert.match(fin.needsYou!.detail, /^Publish the reward list by 28 Oct\./)
  assert.equal(next(c('late', { status: 'Ended', endDate: at(-20 * D) })).next, 'Publish the list (overdue)')
  const claims = c('claims', { status: 'Ended', endDate: at(-5 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-3 * D) } })
  assert.equal(next(claims).next, 'Close when ready')
  assert.equal(next(claims).needsYou, undefined)
})

test('reclaim is offered only once the 30 days are over', () => {
  const closedAt = at(-10 * D)
  const early = c('a', { status: 'Closed', endDate: at(-20 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, closedAt } })
  assert.equal(next(early).needsYou, undefined)
  assert.match(next(early).next, /^Reclaim from /)
  const late = c('b', { status: 'Closed', endDate: at(-60 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, closedAt: at(-1 - CLAIM_GRACE_PERIOD_MS) } })
  assert.equal(next(late).needsYou?.action, 'Reclaim')
  const swept = c('s', { status: 'Closed', settlement: { mode: 'MERKLE_ERC20', erc20Swept: true } })
  assert.equal(next(swept).next, 'Nothing left to do')
})

test('"Draft · funded" only with escrow on record', () => {
  assert.equal(isFundedDraft(c('1', { status: 'Draft', settlement: { mode: 'MERKLE_ERC20', erc20EscrowedNet: '1000' } })), true)
  assert.equal(isFundedDraft(c('2', { status: 'Draft', settlement: { mode: 'MERKLE_ERC20', erc20EscrowedNet: '0' } })), false)
  assert.equal(isFundedDraft(c('3', { status: 'Draft' })), false)
  assert.equal(isFundedDraft(c('4', { settlement: { mode: 'MERKLE_ERC20', erc20EscrowedNet: '5' } })), false)
})

test('"Open now" is time-aware (an ended-but-unrecorded campaign is not open)', () => {
  const rows = hostRows([c('1'), c('2', { endDate: at(-1 * D) }), c('3', { status: 'Draft', participants: 0 })], NOW)
  assert.deepEqual(hostStats(rows), { campaigns: 3, openNow: 1, participants: 8 })
})

test('date ranges read like the mockup', () => {
  assert.equal(dateRange(new Date(2026, 9, 1), new Date(2026, 9, 15)), '1–15 Oct')
  assert.equal(dateRange(new Date(2026, 8, 28), new Date(2026, 9, 3)), '28 Sep – 3 Oct')
  assert.equal(dateRange(new Date(2026, 11, 30), new Date(2027, 0, 4)), '30 Dec 2026 – 4 Jan 2027')
})

test('the CSV quotes what needs quoting and defuses spreadsheet formulas', () => {
  const csv = hostCsv(hostRows([c('1', { title: '=HYPERLINK("x")' }), c('2', { title: 'Plain, with comma' })], NOW))
  const lines = csv.trim().split('\r\n')
  assert.equal(lines[0], 'Campaign ID,Campaign,Status,Participants,Starts,Ends,Next')
  assert.ok(lines.some((l) => l.includes(`"'=HYPERLINK(""x"")"`)))
  assert.ok(lines.some((l) => l.includes('"Plain, with comma"')))
})
