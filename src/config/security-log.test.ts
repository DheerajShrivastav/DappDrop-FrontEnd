import { test } from 'node:test'
import assert from 'node:assert/strict'
import { latestDeployed, securityLog, securityLogVisible, validateSecurityLog } from './security-log'

test('the shipped security log is valid', () => {
  assert.deepEqual(validateSecurityLog(securityLog), [])
})

test('an entry without deployedOn is rejected', () => {
  const errors = validateSecurityLog([{ title: 'Self-marked tasks', foundBy: 'internal review' }])
  assert.ok(errors.some((e) => e.includes('deployedOn')))
  assert.ok(validateSecurityLog([{ title: 'x', foundBy: 'y', deployedOn: 'soon' }]).length > 0)
})

test('only the three latest deployed entries show, newest first', () => {
  const e = ['2026-07-20', '2026-11-02', '2026-10-30', '2026-11-01'].map((d, i) => ({ title: `t${i}`, foundBy: 'f', deployedOn: d }))
  assert.deepEqual(latestDeployed(e).map((x) => x.deployedOn), ['2026-11-02', '2026-11-01', '2026-10-30'])
})

test('the log needs founder approval, a deployed fix and at least one entry', () => {
  const one = [{ title: 't', foundBy: 'f', deployedOn: '2026-11-01' }]
  const on = { securityLogApproved: true, tasksEnforcedOnChain: true, tierModuleFixed: false, tieredCancelLive: false }
  assert.equal(securityLogVisible(on, one), true)
  assert.equal(securityLogVisible({ ...on, securityLogApproved: false }, one), false)
  assert.equal(securityLogVisible({ ...on, tasksEnforcedOnChain: false }, one), false)
  assert.equal(securityLogVisible(on, []), false)
})
