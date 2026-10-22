import { test } from 'node:test'
import assert from 'node:assert/strict'
import { schemaSupportsQueries, REQUIRED_SCHEMA } from './graph-service'

const fields = (names: readonly string[]) => ({ fields: names.map((name) => ({ name })) })

test('accepts the v0.6.0 subgraph schema', () => {
  assert.equal(
    schemaSupportsQueries({
      campaign: fields([...REQUIRED_SCHEMA.Campaign, 'id', 'name']),
      query: fields([...REQUIRED_SCHEMA.Query, '_meta']),
    }),
    true,
  )
})

test('rejects the pre-v0.6.0 schema the production indexer serves today', () => {
  // Field lists introspected from the live endpoint on 2026-10-18.
  assert.equal(
    schemaSupportsQueries({
      campaign: fields(['id', 'host', 'name', 'startTime', 'endTime', 'status', 'totalParticipants', 'createdAt', 'createdAtBlock', 'rewardType', 'rewardTokenAddress', 'rewardAmountOrTokenId', 'tasks', 'participations']),
      query: fields(['campaign', 'campaigns', 'task', 'tasks', 'participation', 'participations', 'taskCompletion', 'taskCompletions', '_meta', '_logs']),
    }),
    false,
  )
})

test('rejects a schema with missing types', () => {
  assert.equal(schemaSupportsQueries({ campaign: null, query: null }), false)
})
