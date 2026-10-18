import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deploymentChainFor, DEPLOYMENT_CHAIN } from './deployment-chain'

test('Sepolia maps to the payment-verification key "sepolia"', () => {
  const c = deploymentChainFor(11155111)
  assert.equal(c.network, 'sepolia')
  assert.equal(c.isTestnet, true)
  assert.equal(c.gasSymbol, 'Sepolia ETH')
})

test('the default deployment chain (no NEXT_PUBLIC_CHAIN_ID) is Sepolia, never mainnet', () => {
  if (process.env.NEXT_PUBLIC_CHAIN_ID) return
  assert.equal(DEPLOYMENT_CHAIN.id, 11155111)
  assert.notEqual(DEPLOYMENT_CHAIN.network, 'ethereum')
})

test('unknown chains get a non-mainnet key', () => {
  assert.equal(deploymentChainFor(999).network, 'chain-999')
})
