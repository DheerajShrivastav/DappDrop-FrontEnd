import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FEE_CAP_NOTE, formatFeeBps, platformFeeLine } from './protocol-fee'

test('formatFeeBps', () => {
  assert.equal(formatFeeBps(250), '2.5%')
  assert.equal(formatFeeBps(1000), '10%')
  assert.equal(formatFeeBps(1), '0.01%')
})

test('platformFeeLine: app-design §3.3 copy', () => {
  assert.equal(platformFeeLine(0, true), 'None during beta')
  assert.equal(platformFeeLine(0, false), 'None during beta')
  assert.equal(platformFeeLine(250, true), '2.5% · the contract caps it at 10%')
  assert.equal(platformFeeLine(250, false), '2.5%', 'no cap claim where the contract does not enforce it')
  assert.equal(platformFeeLine(null, true), 'Couldn’t read · the contract caps it at 10%')
  assert.equal(platformFeeLine(null, false), 'Couldn’t read')
  assert.equal(platformFeeLine(undefined, true), 'Checking…')
  assert.equal(FEE_CAP_NOTE, 'The contract caps any platform fee at 10%.')
})
