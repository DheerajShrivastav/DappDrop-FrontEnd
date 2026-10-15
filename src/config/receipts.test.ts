/**
 * S1-08 AC: only allowlisted receipts render while the fix flags are false; fix-dependent
 * receipts render only with their flag; links never point at undeployed code.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BASELINE_RECEIPTS, RECEIPTS, receiptTarget, visibleReceipts, type ReceiptId } from './receipts'

const allOff = { tasksEnforcedOnChain: false, tierModuleFixed: false, tieredCancelLive: false, hostCloseGuarded: false, nftCustodyFixed: false }

test('with every fix flag off, only the allowlisted receipts render', () => {
  const allow: ReceiptId[] = ['R1', 'R2', 'R3', 'R4', 'R7', 'walletBinding', 'noProxy', 'escrowRead', 'equalSplit', 'leftOff', 'humanityFilter']
  assert.deepEqual([...visibleReceipts(allOff)].sort(), [...allow].sort())
  assert.deepEqual([...BASELINE_RECEIPTS].sort(), [...allow].sort())
})

test('fix-dependent receipts render only with their own flag', () => {
  const cases: [keyof typeof allOff, ReceiptId[]][] = [
    ['hostCloseGuarded', ['R5', 'R6']],
    ['tasksEnforcedOnChain', ['tasks', 'rank']],
    ['tierModuleFixed', ['points']],
    ['nftCustodyFixed', ['nft']],
    ['tieredCancelLive', []],
  ]
  for (const [flag, ids] of cases) {
    const extra = visibleReceipts({ ...allOff, [flag]: true }).filter((id) => !BASELINE_RECEIPTS.includes(id))
    assert.deepEqual(extra.sort(), [...ids].sort(), flag)
  }
})

const env = {
  reposContracts: 'https://github.com/o/contracts',
  networkName: 'Sepolia',
  explorerName: 'Sepolia Etherscan',
  codeUrl: (a: string) => `https://sepolia.etherscan.io/address/${a}#code`,
  addresses: { entrypoint: '0xE', rewardModule: '0xR', nftModule: '0xN' },
}

test('without a deployed tag, receipts fall back to the verified source, never to dev', () => {
  for (const id of Object.keys(RECEIPTS) as ReceiptId[]) {
    const t = receiptTarget(id, { deployedTag: null, deployVersion: null }, env)
    if (RECEIPTS[id].kind === 'app') {
      assert.equal(t, null, id)
      continue
    }
    assert.ok(t && t.href.startsWith('https://sepolia.etherscan.io/address/0x') && t.href.endsWith('#code'), id)
    assert.match(t!.where, /verified source on Sepolia Etherscan/)
  }
  assert.equal(receiptTarget('rank', { deployedTag: null, deployVersion: null }, env)!.href, env.codeUrl('0xR'))
  assert.equal(receiptTarget('nft', { deployedTag: null, deployVersion: null }, env)!.href, env.codeUrl('0xN'))
})

test('with a deployed tag, receipts point at the file at that tag and name the version', () => {
  const t = receiptTarget('R4', { deployedTag: 'v0.7.0-sepolia', deployVersion: '0.7.0' }, env)!
  assert.equal(t.href, 'https://github.com/o/contracts/blob/v0.7.0-sepolia/src/CampaignStorage.sol')
  assert.equal(t.where, 'deployed v0.7.0 on Sepolia')
  for (const id of Object.keys(RECEIPTS) as ReceiptId[]) {
    const x = receiptTarget(id, { deployedTag: 'v0.7.0-sepolia', deployVersion: '0.7.0' }, env)
    if (x) assert.ok(!/\/(blob|tree)\/dev\//.test(x.href), id)
  }
})
