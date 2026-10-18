import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  HIDDEN_CAMPAIGNS_BY_ENTRYPOINT,
  hiddenCampaignIdsFor,
  partitionHiddenCampaigns,
} from './hidden-campaigns'

const list = ['7', '6', '4', '3', '2', '1'].map((id) => ({ id }))
const SEPOLIA = '0xf0A2Fac02ffBA4A7762f2f0d611253B6C97bB1B3'

test('hides exactly the listed test runs for the Sepolia entrypoint, keeping order', () => {
  const { visible, hidden } = partitionHiddenCampaigns(list, hiddenCampaignIdsFor(SEPOLIA))
  assert.deepEqual(visible.map((c) => c.id), ['7', '6'])
  assert.deepEqual(hidden.map((c) => c.id), ['4', '3', '2', '1'])
})

test('entrypoint lookup is case-insensitive', () => {
  assert.equal(hiddenCampaignIdsFor(SEPOLIA.toUpperCase().replace('0X', '0x')).size, 4)
})

test('a different deployment (ids restart at 1) hides nothing', () => {
  const { visible, hidden } = partitionHiddenCampaigns(
    list,
    hiddenCampaignIdsFor('0x0000000000000000000000000000000000000001'),
  )
  assert.equal(visible.length, list.length)
  assert.equal(hidden.length, 0)
})

test('an empty hidden set shows everything', () => {
  const { visible, hidden } = partitionHiddenCampaigns(list, new Set())
  assert.equal(visible.length, 6)
  assert.equal(hidden.length, 0)
})

test('config keys are lowercase addresses', () => {
  for (const key of Object.keys(HIDDEN_CAMPAIGNS_BY_ENTRYPOINT)) {
    assert.match(key, /^0x[0-9a-f]{40}$/)
  }
})
