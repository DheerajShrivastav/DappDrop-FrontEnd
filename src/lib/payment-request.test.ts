import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paymentRequestFromTask, pendingPaymentKey } from './payment-request'
import { isNativePaymentToken, toBaseUnits } from './payment-verification'

const RECIPIENT = '0x1111111111111111111111111111111111111111'
const TOKEN = '0x2222222222222222222222222222222222222222'

const task = (metadata: Record<string, unknown>, type = 'ONCHAIN_TX') =>
  ({ type, metadata }) as Parameters<typeof paymentRequestFromTask>[0]

test('toBaseUnits converts the whole-unit amount the wizard saves', () => {
  assert.equal(toBaseUnits('0.001', 18), BigInt('1000000000000000'))
  assert.equal(toBaseUnits(' 2 ', 6), BigInt(2000000))
  assert.equal(toBaseUnits('1.5', 6), BigInt(1500000))
})

test('toBaseUnits rejects zero, negatives, junk and too many decimals', () => {
  for (const bad of ['0', '0.0', '-1', '1e-3', 'abc', '', '1.2345678', undefined, null]) {
    assert.equal(toBaseUnits(bad as string, 6), null, String(bad))
  }
})

test('isNativePaymentToken: null, empty, 0x0 and the zero address are ETH', () => {
  for (const t of [null, undefined, '', '0x0', '0x0000000000000000000000000000000000000000']) {
    assert.equal(isNativePaymentToken(t), true, String(t))
  }
  assert.equal(isNativePaymentToken(TOKEN), false)
})

test('an ETH payment task as the wizard saves it', () => {
  const req = paymentRequestFromTask(
    task({ paymentRequired: true, paymentRecipient: RECIPIENT, chainId: 11155111, tokenAddress: null, tokenSymbol: 'ETH', amount: '0.001', amountDisplay: '0.001 ETH' }),
    1,
  )
  assert.deepEqual(req, {
    recipient: RECIPIENT,
    amount: '0.001',
    amountDisplay: '0.001 ETH',
    tokenAddress: null,
    tokenSymbol: 'ETH',
    chainId: 11155111,
  })
})

test('an ERC-20 payment task keeps its token, and fills in display text and chain', () => {
  const req = paymentRequestFromTask(task({ paymentRequired: true, paymentRecipient: RECIPIENT, tokenAddress: TOKEN, tokenSymbol: 'USDC', amount: '5' }), 11155111)
  assert.equal(req?.tokenAddress, TOKEN)
  assert.equal(req?.amountDisplay, '5 USDC')
  assert.equal(req?.chainId, 11155111)
})

test('the amount shown is the real charge, never the host’s free text', () => {
  const req = paymentRequestFromTask(task({ paymentRequired: true, paymentRecipient: RECIPIENT, tokenSymbol: 'ETH', amount: '1', amountDisplay: '0.0001 ETH' }), 1)
  assert.equal(req?.amountDisplay, '1 ETH')
})

test('not a payment request: other task types, no payment, or broken settings', () => {
  const ok = { paymentRequired: true, paymentRecipient: RECIPIENT, amount: '1' }
  assert.equal(paymentRequestFromTask(task(ok, 'JOIN_DISCORD'), 1), null)
  assert.equal(paymentRequestFromTask(task({ ...ok, paymentRequired: false }), 1), null)
  assert.equal(paymentRequestFromTask(task({ ...ok, paymentRecipient: '0x123' }), 1), null)
  assert.equal(paymentRequestFromTask(task({ ...ok, amount: '0' }), 1), null)
  assert.equal(paymentRequestFromTask(task({ ...ok, tokenAddress: 'not-an-address' }), 1), null)
  assert.equal(paymentRequestFromTask({ type: 'ONCHAIN_TX' } as Parameters<typeof paymentRequestFromTask>[0], 1), null)
})

test('pendingPaymentKey is per campaign, task and wallet (case-insensitive)', () => {
  assert.equal(pendingPaymentKey('5', 't1', '0xAbC'), pendingPaymentKey('5', 't1', '0xabc'))
  assert.notEqual(pendingPaymentKey('5', 't1', '0xabc'), pendingPaymentKey('5', 't2', '0xabc'))
})
