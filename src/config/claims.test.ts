/**
 * QW-06 unit tests for the claims flags. Run: npm run test:unit
 *
 * The plan's AC is "launchStage === 1 for today's truth, and 2 only when all four redeploy flags
 * are true". The shipped config is set to the post-redeploy state (founder decision 2026-10-07),
 * so the Stage 1 case is tested with an explicit "deployed v0.6.0" fixture.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { claims, claimsVersion, deriveClaimsVersion, deriveLaunchStage, launchStage, releaseBlockers, STAGE_2_FLAGS, type Claims } from './claims'

/** Today's truth on the deployed v0.6.0 contracts: every fix flag off. */
const deployedV060: Claims = {
  ...claims,
  deployVersion: '0.6.0',
  deployedTag: 'v0.6.0',
  testsAtDeployed: 244,
  tasksEnforcedOnChain: false,
  tierModuleFixed: false,
  tieredCancelLive: false,
  rolesSplit: false,
  hostCloseGuarded: false,
  nftCustodyFixed: false,
  feeCapEnforced: false,
  hostCloseFixCommitted: false,
  nftFixCommitted: false,
}

test('the v0.6.0 truth (all fix flags off) is Stage 1', () => {
  assert.equal(deriveLaunchStage(deployedV060), 1)
})

test('Stage 2 needs all four redeploy flags; any one missing stays Stage 1', () => {
  const allOn = { ...deployedV060, tasksEnforcedOnChain: true, tierModuleFixed: true, tieredCancelLive: true, rolesSplit: true }
  assert.equal(deriveLaunchStage(allOn), 2)
  for (const k of STAGE_2_FLAGS) {
    assert.equal(deriveLaunchStage({ ...allOn, [k]: false }), 1, `${k} off must keep Stage 1`)
  }
})

test('hostCloseGuarded and nftCustodyFixed do not decide the stage', () => {
  assert.equal(deriveLaunchStage({ ...deployedV060, hostCloseGuarded: true, nftCustodyFixed: true }), 1)
})

test('the shipped config is the post-redeploy state (Stage 2)', () => {
  assert.equal(launchStage, 2)
  assert.match(claimsVersion, /^s2-[0-9a-f]{8}$/)
})

test('claimsVersion is stable and changes when any flag flips', () => {
  assert.equal(deriveClaimsVersion(claims), deriveClaimsVersion({ ...claims }))
  assert.notEqual(deriveClaimsVersion(claims), deriveClaimsVersion({ ...claims, keeperLive: !claims.keeperLive }))
  assert.match(deriveClaimsVersion(deployedV060), /^s1-/)
})

test('undecided founder items keep their safe defaults', () => {
  assert.equal(claims.officialLinks.length, 0, 'no social handles until the founder confirms them')
  assert.equal(claims.licenseFile, false, 'say "public code" until the contracts repo has a LICENSE')
  assert.equal(claims.foundingHosts.open, false)
  assert.equal(claims.campaignsCurated, false)
  assert.equal(claims.paymentTaskChainLocked, false)
})

test('releaseBlockers lists the unset redeploy facts', () => {
  const blockers = releaseBlockers({ ...claims, deployVersion: null, deployedTag: null })
  assert.ok(blockers.some((b) => b.startsWith('deployVersion')))
  assert.ok(blockers.some((b) => b.startsWith('deployedTag')))
  const ready = releaseBlockers({
    ...claims,
    deployVersion: '0.7.0',
    deployedTag: 'v0.7.0-sepolia',
    testsAtDeployed: 300,
    contractsDeployedOn: '2026-11-01',
    founderContact: { channel: 'email', url: 'mailto:founder@example.org' },
    faucetUrl: 'https://faucet.example.org',
    privacyNoticeUrl: 'https://example.org/privacy',
  })
  assert.deepEqual(ready, [])
})
