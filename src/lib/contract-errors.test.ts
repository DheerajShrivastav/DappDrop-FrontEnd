import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AbiCoder, Interface, ZeroAddress, ZeroHash, id, type ErrorFragment, type InterfaceAbi, type ParamType } from 'ethers'
import Web3Campaigns from './abi/Web3Campaigns.json'
import OnChainRewardModule from './abi/OnChainRewardModule.json'
import NFTSettlementModule from './abi/NFTSettlementModule.json'
import {
  KNOWN_CONTRACT_ERRORS,
  contractErrorInterface,
  contractErrorMessage,
  contractErrorName,
  decodeContractError,
  describeContractError,
  findRevertData,
} from './contract-errors'

const iface = contractErrorInterface()
const entrypoint = new Interface(Web3Campaigns.abi as InterfaceAbi)
const GENERIC = 'The transaction didn’t go through'

function sample(p: ParamType): unknown {
  if (p.baseType === 'address') return ZeroAddress
  if (p.baseType === 'bytes32') return ZeroHash
  if (p.baseType === 'string') return 'x'
  if (p.baseType.startsWith('uint') || p.baseType.startsWith('int')) return BigInt(7)
  throw new Error(`no sample for ${p.type}`)
}
const encode = (f: ErrorFragment) => iface.encodeErrorResult(f, f.inputs.map(sample))
const fragments: ErrorFragment[] = []
iface.forEachError((f) => fragments.push(f))

const abiErrorNames = new Set(
  [Web3Campaigns.abi, OnChainRewardModule.abi, NFTSettlementModule.abi]
    .flat()
    .filter((x: { type: string }) => x.type === 'error')
    .map((x: { name?: string }) => x.name as string),
)

const errorString = (s: string) => '0x08c379a0' + AbiCoder.defaultAbiCoder().encode(['string'], [s]).slice(2)

test('every custom error in the vendored ABIs has its own message', () => {
  // 78 distinct names across the three ABIs at contracts 2a2745a; a new ABI that changes this must
  // come with messages for its new errors.
  assert.equal(abiErrorNames.size, 78)
  const missing = [...abiErrorNames].filter((n) => !KNOWN_CONTRACT_ERRORS.includes(n))
  assert.deepEqual(missing, [])
  // and the redeploy's five new ones are there
  for (const n of ['RateLimited', 'InvalidTextLength', 'TooManyTasks', 'AccountFlagged', 'NotInActivePeriod']) {
    assert.ok(abiErrorNames.has(`Web3Campaigns__${n}`), n)
  }
})

test('each error decodes from encoded revert data, with a specific message (not the fallback)', () => {
  for (const f of fragments) {
    const d = describeContractError({ code: 'CALL_EXCEPTION', data: encode(f) })
    assert.equal(d.name, f.name, f.format())
    assert.notEqual(d.message, 'Transaction failed. Please try again.', f.name)
    assert.ok(!d.message.includes('__'), `${f.name}: no raw error names in copy`)
    assert.ok(d.title && !/error/i.test(d.title), `${f.name}: a title without "Error"`)
    assert.ok(/[.?]$/.test(d.message), `${f.name}: message is a sentence`)
  }
})

test('finds the data in every ethers v6 / wallet error shape', () => {
  const data = iface.encodeErrorResult('Web3Campaigns__RateLimited', [])
  const shapes: unknown[] = [
    { data },
    { data: { data } },
    { error: { data } },
    { info: { error: { data } } },
    { info: { error: { data: { data } } } },
    { error: { error: { data } } },
    { error: { data: { originalError: { data } } } },
    { cause: { data } },
    { info: { error: { body: JSON.stringify({ jsonrpc: '2.0', error: { code: 3, data } }) } } },
    { message: `execution reverted (unknown custom error) (action="estimateGas", data="${data}", reason=null)` },
  ]
  for (const s of shapes) {
    assert.equal(contractErrorName(s), 'Web3Campaigns__RateLimited', JSON.stringify(s))
  }
  assert.deepEqual(findRevertData({ data: '0x' }), [])
  assert.deepEqual(findRevertData({ data: '0x1234' }), [], 'shorter than a selector')
})

test('a genuine ethers CallExceptionError (contract with the ABI) decodes', () => {
  const tx = { to: ZeroAddress, data: entrypoint.encodeFunctionData('closeCampaign', [1]) }
  const err = entrypoint.makeError(entrypoint.encodeErrorResult('Web3Campaigns__SettlementNotPublished', []), tx)
  assert.equal(err.code, 'CALL_EXCEPTION')
  assert.equal(err.revert?.name, 'Web3Campaigns__SettlementNotPublished')
  const d = describeContractError(err)
  assert.deepEqual(d, { kind: 'revert', name: 'Web3Campaigns__SettlementNotPublished', title: 'Can’t close yet', message: 'Publish the reward list first.' })
})

test('a genuine ethers error with no ABI (estimateGas through the wallet) decodes from its data', () => {
  const tx = { to: ZeroAddress, data: entrypoint.encodeFunctionData('createCampaign', ['n', 1, 2]) }
  const err = new Interface([]).makeError(iface.encodeErrorResult('Web3Campaigns__RateLimited', []), tx)
  assert.equal(err.revert, null)
  assert.match(describeContractError(err).message, /one campaign every 5 minutes/)
})

test('ethers error.revert alone (data already consumed) still decodes', () => {
  assert.equal(contractErrorName({ code: 'CALL_EXCEPTION', revert: { name: 'Web3Campaigns__TooManyTasks', args: [] } }), 'Web3Campaigns__TooManyTasks')
})

test('app-design §3.2: the six errors that replaced revert strings use the approved copy', () => {
  const d = (name: string) => describeContractError({ data: iface.encodeErrorResult(name, []) })
  assert.deepEqual(d('Web3Campaigns__RateLimited'), { kind: 'revert', name: 'Web3Campaigns__RateLimited', title: 'Too many actions in a row', message: 'Wait a moment, then try again.' })
  assert.deepEqual(d('Web3Campaigns__InvalidTextLength'), {
    kind: 'revert',
    name: 'Web3Campaigns__InvalidTextLength',
    title: 'That text doesn’t fit',
    message: 'It’s empty or too long. Shorten it and try again.',
  })
  assert.deepEqual(d('Web3Campaigns__TooManyTasks'), {
    kind: 'revert',
    name: 'Web3Campaigns__TooManyTasks',
    title: 'Too many tasks',
    message: 'A campaign can have at most 20 tasks. Remove one to continue.',
  })
  assert.equal(d('Web3Campaigns__AccountFlagged').title, 'This wallet can’t take part right now')
  assert.match(d('Web3Campaigns__AccountFlagged').message, /^If you think that’s a mistake/)
  assert.deepEqual(d('Web3Campaigns__NotInActivePeriod'), {
    kind: 'revert',
    name: 'Web3Campaigns__NotInActivePeriod',
    title: 'This campaign isn’t running',
    message: 'It hasn’t started yet, or it has already ended.',
  })
  assert.deepEqual(d('Web3Campaigns__SettlementNotPublished'), {
    kind: 'revert',
    name: 'Web3Campaigns__SettlementNotPublished',
    title: 'Can’t close yet',
    message: 'Publish the reward list first.',
  })
})

test('the reverting function sharpens the message (invocation or tx calldata)', () => {
  const rate = iface.encodeErrorResult('Web3Campaigns__RateLimited', [])
  assert.match(contractErrorMessage({ data: rate, invocation: { method: 'completeTask' } }), /30 seconds between tasks/)
  assert.match(
    contractErrorMessage({ data: rate, transaction: { data: entrypoint.encodeFunctionData('createCampaign', ['n', 1, 2]) } }),
    /one campaign every 5 minutes/,
  )
  const text = iface.encodeErrorResult('Web3Campaigns__InvalidTextLength', [])
  assert.match(contractErrorMessage({ data: text, invocation: { method: 'batchAddTasks' } }), /1,000 characters/)
  assert.match(contractErrorMessage({ data: text, invocation: { method: 'createCampaign' } }), /200 characters/)
  assert.match(contractErrorMessage({ data: text, invocation: { method: 'setOffChainReward' } }), /500 characters/)
  const started = iface.encodeErrorResult('Web3Campaigns__CampaignAlreadyStarted', [])
  assert.equal(contractErrorMessage({ data: started, invocation: { method: 'openCampaign' } }), 'This campaign has already been opened.')
  assert.match(contractErrorMessage({ data: started, invocation: { method: 'addTaskToCampaign' } }), /still a draft/)
})

test('AccessControlUnauthorizedAccount names the host role when that is what is missing', () => {
  const data = iface.encodeErrorResult('AccessControlUnauthorizedAccount', [ZeroAddress, id('HOST_ROLE')])
  assert.match(contractErrorMessage({ data }), /host role/)
  const other = iface.encodeErrorResult('AccessControlUnauthorizedAccount', [ZeroAddress, id('MODERATOR_ROLE')])
  assert.doesNotMatch(contractErrorMessage({ data: other }), /host role/)
})

test('string reverts from the pre-redeploy contract map to the custom error that replaced them', () => {
  const cases: [string, string][] = [
    ['Campaign not in active period', 'Web3Campaigns__NotInActivePeriod'],
    ['Too many rapid actions', 'Web3Campaigns__RateLimited'],
    ['Rate limit: too many actions', 'Web3Campaigns__RateLimited'],
    ['Account flagged for suspicious activity', 'Web3Campaigns__AccountFlagged'],
    ['Invalid name length', 'Web3Campaigns__InvalidTextLength'],
    ['Too many tasks per campaign', 'Web3Campaigns__TooManyTasks'],
    ['Contract is paused', 'EnforcedPause'],
  ]
  for (const [s, name] of cases) {
    assert.equal(contractErrorName({ data: errorString(s) }), name, `data: ${s}`)
    assert.equal(contractErrorName({ reason: s }), name, `reason text: ${s}`)
  }
})

test('an unknown string revert never shows its raw text', () => {
  const d = describeContractError({ code: 'CALL_EXCEPTION', data: errorString('Some internal detail') })
  assert.equal(d.name, 'Error')
  assert.equal(d.title, GENERIC)
  assert.doesNotMatch(d.message, /internal detail/)
})

test('Panic(0x11) on an NFT move reads as "not held for this campaign"', () => {
  const panic = '0x4e487b71' + AbiCoder.defaultAbiCoder().encode(['uint256'], [0x11]).slice(2)
  assert.match(contractErrorMessage({ data: panic, invocation: { method: 'claimNFT' } }), /aren’t held for this campaign/)
  assert.match(contractErrorMessage({ data: panic }), /safety checks failed/)
})

test('a known error name in text only (some RPCs) is still recognised', () => {
  assert.equal(contractErrorName({ shortMessage: 'execution reverted: Web3Campaigns__SettlementNotPublished()' }), 'Web3Campaigns__SettlementNotPublished')
  assert.equal(contractErrorName({ message: 'reverted with EnforcedPause()' }), 'EnforcedPause')
})

test('fallbacks: unknown selector, wallet rejection, gas, network, our own Error', () => {
  const unknown = describeContractError({ code: 'CALL_EXCEPTION', data: '0xdeadbeef' })
  assert.equal(unknown.name, null)
  assert.match(unknown.message, /contract refused it/)
  assert.equal(describeContractError({ code: 'CALL_EXCEPTION', data: null, shortMessage: 'missing revert data' }).name, null)
  assert.equal(describeContractError({ code: 'ACTION_REJECTED' }).kind, 'rejected')
  assert.match(contractErrorMessage({ code: 'ACTION_REJECTED' }), /cancelled in your wallet/)
  assert.match(contractErrorMessage({ info: { error: { code: 4001 } } }), /cancelled in your wallet/)
  assert.match(contractErrorMessage({ code: 'INSUFFICIENT_FUNDS' }, { gasSymbol: 'Sepolia ETH' }), /enough Sepolia ETH/)
  assert.equal(describeContractError({ code: 'INSUFFICIENT_FUNDS' }).kind, 'gas')
  assert.match(contractErrorMessage({ code: 'NETWORK_ERROR' }), /network didn’t answer/)
  assert.equal(contractErrorMessage(new Error('Could not read the latest block.')), 'Could not read the latest block.')
  assert.equal(contractErrorMessage(undefined), 'Transaction failed. Please try again.')
  assert.equal(decodeContractError(null), null)
})
