#!/usr/bin/env node
/**
 * S2-08: count the contracts' automated tests AT A TAG, so the page's number and its link come
 * from the same ref (TRS F59). Read-only: uses `git grep` against a local clone of the
 * contracts repo; nothing is checked out or modified.
 *
 *   node scripts/count-tests-at-tag.mjs <path-to-contracts-clone> <tag>
 *
 * Counts Foundry test functions (`function test…`, `function testFuzz…`) and invariant
 * functions (`function invariant…`) under test/, and the invariant suites (files that declare
 * one). Paste `tests` into claims.ts `testsAtDeployed` and the tag into `deployedTag`.
 */
import { execFileSync } from 'node:child_process'

const [repo, tag] = process.argv.slice(2)
if (!repo || !tag) {
  console.error('usage: node scripts/count-tests-at-tag.mjs <contracts-repo> <tag>')
  process.exit(1)
}
const grep = (pattern) => {
  try {
    return execFileSync('git', ['-C', repo, 'grep', '-E', '-c', pattern, tag, '--', 'test'], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => ({ file: l.split(':').slice(1, -1).join(':'), n: Number(l.split(':').pop()) }))
  } catch {
    return []
  }
}
const tests = grep('^[[:space:]]*function[[:space:]]+test[A-Za-z0-9_]*[[:space:]]*[(]')
const invariants = grep('^[[:space:]]*function[[:space:]]+invariant[A-Za-z0-9_]*[[:space:]]*[(]')
const sum = (rows) => rows.reduce((a, r) => a + r.n, 0)
const result = {
  tag,
  tests: sum(tests) + sum(invariants),
  testFunctions: sum(tests),
  invariantFunctions: sum(invariants),
  invariantSuites: invariants.length,
}
console.log(JSON.stringify(result, null, 2))
