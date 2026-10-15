#!/usr/bin/env node
/**
 * S1-10: the landing components must never import app code or wallet libraries (the plan's
 * ESLint no-restricted-imports rule, as a script: the repo has no ESLint config, and adding one
 * would make `next build` lint the whole app).
 *
 * Blocks, in src/components/landing/** and src/app/(landing)/** (every marketing page):
 *   @/app/(app)/*, wagmi, viem, @rainbow-me/*, ethers, framer-motion, next/link.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOTS = ['src/components/landing', 'src/app/(landing)']
const BANNED = [/^@\/app\/\(app\)\//, /^wagmi(\/|$)/, /^viem(\/|$)/, /^@rainbow-me\//, /^ethers(\/|$)/, /^framer-motion(\/|$)/, /^next\/link$/]

const files = []
const walk = (p) => {
  if (statSync(p).isDirectory()) readdirSync(p).forEach((n) => walk(path.join(p, n)))
  else if (/\.(tsx?|jsx?)$/.test(p)) files.push(p)
}
ROOTS.forEach((r) => walk(path.join(process.cwd(), r)))

const hits = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const spec = m[1] || m[2]
    if (BANNED.some((re) => re.test(spec))) hits.push(`${path.relative(process.cwd(), f)} imports "${spec}"`)
  }
}
if (hits.length) {
  console.error('✖ restricted imports in landing code:\n  ' + hits.join('\n  '))
  process.exit(1)
}
console.log(`✔ no restricted imports in ${files.length} landing files`)
