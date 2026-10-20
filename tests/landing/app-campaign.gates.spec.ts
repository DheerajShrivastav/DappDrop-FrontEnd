/**
 * 08-site phase 2 (Builder A): gates for the campaign page, /campaign/[id].
 *
 * Production build (npm run build && GATES_PORT=3201 npm run test:gates):
 * - real campaigns from the deployment (RPC fallback): FULL-page axe 0 (not just the shell) in
 *   both themes at 320/375/768/1440, no horizontal scroll, one h1, the ribbon, the rail;
 * - the not-found state; the dev fixture route is a 404.
 *
 * Wallet-only states (connected, host, claimable…) render only on the dev fixture route
 * /_dev/campaign, which 404s in production. Point GATES_DEV_URL at a dev server to gate them too:
 *   GATES_DEV_URL=http://localhost:3200 npx playwright test app-campaign
 */
import { test, expect, type Page } from '@playwright/test'

const AXE = require.resolve('axe-core/axe.min.js')
const THEMES = ['obsidian', 'porcelain'] as const
const WIDTHS: [number, number][] = [
  [320, 640],
  [375, 812],
  [768, 1024],
  [1440, 900],
]
// Real campaigns on the Sepolia deployment: #4 (NFT, list overdue: the claim panel's connect
// state) and #6 (end time passed, not recorded: the ribbon's "not recorded yet").
const REAL = ['/campaign/4', '/campaign/6'] as const

async function remember(page: Page, theme: string) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('dd-theme', t)
    } catch {}
  }, theme)
}

/** Load, wait for the hydrated account pill and for the campaign (or its error state). */
async function openCampaign(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 })
  await page.locator('[data-account-pill]:not([data-account-pill="loading"])').first().waitFor({ state: 'attached', timeout: 30_000 })
  await page.locator('.cp-ribbon-wrap, main h2').first().waitFor({ timeout: 60_000 })
  // Let the claim panel / reward list settle (their skeletons are aria-busy).
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]'), null, { timeout: 30_000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
}

async function axe(page: Page) {
  await page.addScriptTag({ path: AXE })
  return page.evaluate(async () => {
    // @ts-expect-error axe is injected above
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })
    return r.violations.map((v: { id: string; nodes: { target: string[] }[] }) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  })
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test.describe('campaign page (08-site phase 2)', () => {
  test.describe.configure({ timeout: 180_000 })

  for (const path of REAL) {
    for (const t of THEMES) {
      for (const [width, height] of WIDTHS) {
        test(`${path} · ${t} · ${width} px: full-page axe 0, no horizontal scroll`, async ({ page }) => {
          await remember(page, t)
          await page.setViewportSize({ width, height })
          await openCampaign(page, path)
          expect(await axe(page)).toEqual([])
          expect(await overflow(page)).toBe(0)
        })
      }
    }
  }

  test('/campaign/4: one h1 (the name), the ribbon with one current stop, the claim panel asks to connect, the rail', async ({ page }) => {
    await openCampaign(page, '/campaign/4')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page).toHaveTitle(/^.+ · DappDrop$/)
    const name = (await page.locator('h1').innerText()).trim()
    await expect(page).toHaveTitle(`${name} · DappDrop`)
    await expect(page.locator('.cp-ribbon [aria-current="step"]')).toHaveCount(1)
    await expect(page.locator('[data-reward-state="connect"]')).toContainText('Connect your wallet to see if you have a reward.')
    await expect(page.getByRole('complementary', { name: 'Campaign facts' })).toContainText('Sepolia testnet')
    // The old page's invented and contradictory bits are gone.
    await expect(page.locator('main')).not.toContainText(/Reward for|TBD|Campaign Info/)
  })

  test('/campaign/6: the end is not recorded yet; tasks are closed and say when', async ({ page }) => {
    await openCampaign(page, '/campaign/6')
    await expect(page.locator('.cp-ribbon [aria-current="step"]')).toContainText('not recorded yet')
    await expect(page.locator('main')).toContainText('Tasks closed when the campaign ended on')
    // Not connected: nobody is offered a task action or "Record the end" without a wallet.
    await expect(page.getByRole('button', { name: /^Start/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Record the end' })).toHaveCount(0)
  })

  test('an unknown campaign renders the in-page not-found state with a way back', async ({ page }) => {
    await page.goto('/campaign/999999', { waitUntil: 'load' })
    await expect(page.getByText('We couldn’t find campaign #999999.')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('link', { name: 'Browse campaigns' })).toHaveAttribute('href', '/campaigns')
  })

  test('the campaign fixtures are unreachable in a production build', async ({ request }) => {
    const res = await request.get('/_dev/campaign')
    expect(res.status()).toBe(404)
  })
})

// ---------------------------------------------------------------------------------------------
// Dev fixtures (only with GATES_DEV_URL): every wallet-only state.
// ---------------------------------------------------------------------------------------------
const DEV = process.env.GATES_DEV_URL
const STATES = [
  'p-open-visitor',
  'p-open-tasks',
  'p-full',
  'p-record-end',
  'p-waiting',
  'p-review',
  'p-claimable',
  'p-claim-processing',
  'p-claim-fallback',
  'p-claim-by',
  'p-claimed',
  'p-not-on-list',
  'p-swept',
  'p-claim-visitor',
  'p-nft',
  'p-tiered',
  'p-tiered-no-rank',
  'h-draft',
  'h-open',
  'h-record-end',
  'h-publish',
  'h-review',
  'h-close',
  'h-closed',
  'h-swept',
]
const ALL_WIDTHS = new Set(['p-open-tasks', 'p-claimable', 'p-claim-fallback', 'h-publish', 'h-review'])

test.describe('campaign page fixtures (dev server)', () => {
  test.skip(!DEV, 'set GATES_DEV_URL to a dev server to gate the wallet-only states')
  test.describe.configure({ timeout: 180_000 })

  for (const state of STATES) {
    for (const t of THEMES) {
      for (const [width, height] of WIDTHS.filter(([w]) => ALL_WIDTHS.has(state) || w === 375 || w === 1440)) {
        test(`${state} · ${t} · ${width} px: full-page axe 0, no horizontal scroll`, async ({ page }) => {
          await remember(page, t)
          await page.setViewportSize({ width, height })
          await openCampaign(page, `${DEV}/_dev/campaign?state=${state}`)
          expect(await axe(page)).toEqual([])
          expect(await overflow(page)).toBe(0)
        })
      }
    }
  }

  test('claimable: gas-free is the gold primary, the wallet claim sits next to it, and both are reachable by keyboard', async ({ page }) => {
    await openCampaign(page, `${DEV}/_dev/campaign?state=p-claimable`)
    const gasFree = page.getByRole('button', { name: 'Claim 250 EXAMPLE, gas-free' })
    const own = page.getByRole('button', { name: 'Claim with my wallet' })
    await expect(gasFree).toBeEnabled()
    await expect(own).toBeEnabled()
    await page.getByRole('link', { name: 'Campaigns' }).first().focus()
    const reached: string[] = []
    for (let i = 0; i < 40 && reached.length < 2; i++) {
      await page.keyboard.press('Tab')
      const text = await page.evaluate(() => (document.activeElement?.tagName === 'BUTTON' ? document.activeElement.textContent?.trim() : '') ?? '')
      if (/gas-free|my wallet/.test(text) && !reached.includes(text)) reached.push(text)
    }
    expect(reached).toEqual(['Claim 250 EXAMPLE, gas-free', 'Claim with my wallet'])
  })

  test('review window: both claim buttons are disabled, with the time in words', async ({ page }) => {
    await openCampaign(page, `${DEV}/_dev/campaign?state=p-review`)
    await expect(page.getByRole('button', { name: /gas-free/ })).toBeDisabled()
    await expect(page.locator('[data-reward-state="review"]')).toContainText(/Claims open \d+ \w+, \d\d:\d\d \(in /)
  })

  test('gas-free unavailable: the wallet claim becomes the primary, with the reason and a retry', async ({ page }) => {
    await openCampaign(page, `${DEV}/_dev/campaign?state=p-claim-fallback`)
    await expect(page.locator('[data-claim-actions="wallet"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Claim 250 EXAMPLE with my wallet' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Try gas-free again' })).toBeVisible()
  })

  test('host: the close guard says why Close is disabled while the list is unpublished', async ({ page }) => {
    await openCampaign(page, `${DEV}/_dev/campaign?state=h-publish`)
    await expect(page.locator('[data-host-bar]')).toContainText('publish the reward list by')
    await expect(page.locator('[data-step="list"]')).toHaveAttribute('aria-current', 'step')
    const close = page.getByRole('button', { name: 'Close campaign' })
    await expect(close).toBeDisabled()
    await expect(close).toHaveAccessibleDescription(/Publish the reward list first/)
    await expect(page.getByRole('button', { name: 'Publish the list' })).toBeEnabled()
  })

  test('host: an open campaign has no End button; any wallet past the end time can record it', async ({ page }) => {
    await openCampaign(page, `${DEV}/_dev/campaign?state=h-open`)
    await expect(page.getByRole('button', { name: /^End/ })).toHaveCount(0)
    await openCampaign(page, `${DEV}/_dev/campaign?state=p-record-end`)
    await expect(page.getByRole('button', { name: 'Record the end' })).toBeVisible()
  })

  test('tasks: actions for a connected wallet, the failed row says why, full uses the real cap', async ({ page }) => {
    await openCampaign(page, `${DEV}/_dev/campaign?state=p-open-tasks`)
    await expect(page.locator('[data-task-state="failed"]')).toContainText('Couldn’t verify')
    await expect(page.getByRole('button', { name: /^Start/ })).toHaveCount(1)
    await openCampaign(page, `${DEV}/_dev/campaign?state=p-full`)
    await expect(page.locator('main')).toContainText('This campaign is full (500 of 500).')
  })
})
