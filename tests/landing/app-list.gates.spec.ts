/**
 * 08-site phase 2, Builder B: /campaigns, /dashboard, /admin and /humanity-callback.
 * Run against a production build: npm run build && npm run test:gates
 *
 * Unlike the phase 1 shell gates, axe here covers the FULL page (body included), in both themes,
 * at 320 / 375 / 768 / 1440 px. The wallet-only states (the claim strip, a host's dashboard) are
 * checked on the dev fixture route /_dev/list (see landing-studio/08-site/build/phase2-B-handoff.md);
 * in production that route must 404.
 */
import { test, expect, type Page } from '@playwright/test'

const AXE = require.resolve('axe-core/axe.min.js')
const THEMES = ['obsidian', 'porcelain'] as const
const WIDTHS = [
  [320, 640],
  [375, 812],
  [768, 1024],
  [1440, 900],
] as const

async function remember(page: Page, theme: string) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('dd-theme', t)
    } catch {}
  }, theme)
}

async function openApp(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'load' })
  await page.locator('[data-account-pill]:not([data-account-pill="loading"])').first().waitFor({ state: 'attached', timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
}

/** /campaigns has settled: the list, an empty state or the error state (never just skeletons). */
async function campaignsSettled(page: Page) {
  await page.locator('section[aria-label="Campaign list"] :is(ul, h2, [data-error-state])').first().waitFor({ timeout: 30_000 })
  await expect(page.locator('section[aria-label="Campaign list"] [aria-busy="true"]')).toHaveCount(0)
}

async function axe(page: Page) {
  await page.addScriptTag({ path: AXE })
  return page.evaluate(async () => {
    // @ts-expect-error axe is injected above
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })
    return r.violations.map((v: { id: string; nodes: { target: string[] }[] }) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  })
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth)

test.describe('app list + dashboard (08-site phase 2, Builder B)', () => {
  for (const t of THEMES) {
    for (const [width, height] of WIDTHS) {
      test(`/campaigns · ${t} · ${width} px: full-page axe 0, no horizontal overflow`, async ({ page }) => {
        await remember(page, t)
        await page.setViewportSize({ width, height })
        await openApp(page, '/campaigns')
        await campaignsSettled(page)
        expect(await axe(page)).toEqual([])
        expect(await noOverflow(page)).toBe(true)
      })

      test(`/dashboard · ${t} · ${width} px: the in-place connect state, full-page axe 0, no overflow`, async ({ page }) => {
        await remember(page, t)
        await page.setViewportSize({ width, height })
        await openApp(page, '/dashboard')
        await expect(page.getByRole('heading', { level: 2, name: 'Connect the wallet you host with.' })).toBeVisible()
        expect(await axe(page)).toEqual([])
        expect(await noOverflow(page)).toBe(true)
      })
    }

    for (const path of ['/admin', '/humanity-callback']) {
      for (const [width, height] of [WIDTHS[1], WIDTHS[3]]) {
        test(`${path} · ${t} · ${width} px: full-page axe 0, no overflow`, async ({ page }) => {
          await remember(page, t)
          await page.setViewportSize({ width, height })
          await openApp(page, path)
          await expect(page.locator('main h1')).toHaveCount(1)
          expect(await axe(page)).toEqual([])
          expect(await noOverflow(page)).toBe(true)
        })
      }
    }
  }

  test('/campaigns: one h1, the testnet lead, and no placeholder data', async ({ page }) => {
    await openApp(page, '/campaigns')
    await campaignsSettled(page)
    await expect(page.locator('main h1')).toHaveText('Campaigns')
    await expect(page.locator('main')).toContainText('Sepolia testnet')
    const text = await page.locator('main').innerText()
    expect(text).not.toMatch(/Reward TBD|600 × 400|Reward for /)
  })

  test('/campaigns: the filters are named controls and work from the keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openApp(page, '/campaigns')
    await campaignsSettled(page)
    const search = page.getByRole('searchbox', { name: 'Search campaigns' })
    await expect(search).toBeVisible()
    for (const name of ['Reward', 'Payout', 'Sort']) await expect(page.getByRole('combobox', { name }).first()).toBeVisible()
    const all = page.getByRole('radio', { name: /^All · \d+$/ })
    await all.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: /^Open · \d+$/ })).toBeChecked()
    // Phone: Status + "More filters" (a disclosure).
    await page.setViewportSize({ width: 375, height: 812 })
    const more = page.getByRole('button', { name: 'More filters' })
    await expect(more).toHaveAttribute('aria-expanded', 'false')
    await more.click()
    await expect(more).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('combobox', { name: 'Payout' }).last()).toBeVisible()
  })

  test('/dashboard: no redirect and no toast for a disconnected visitor (APP-12)', async ({ page }) => {
    await openApp(page, '/dashboard')
    await expect(page.getByRole('heading', { level: 2, name: 'Connect the wallet you host with.' })).toBeVisible()
    await page.waitForTimeout(1500)
    expect(new URL(page.url()).pathname).toBe('/dashboard')
    await expect(page.locator('main h1')).toHaveText('Your campaigns')
    await expect(page.getByRole('main').getByRole('button', { name: 'Connect wallet' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'Start a campaign' })).toHaveAttribute('href', '/create-campaign')
    await expect(page.getByText('Unauthorized')).toHaveCount(0)
  })

  test('/humanity-callback: an honest state instead of a crash when Humanity is not configured', async ({ page }) => {
    await openApp(page, '/humanity-callback')
    await expect(page.locator('#__next_error__')).toHaveCount(0)
    await expect(page.locator('main h1')).toHaveText('Verifying')
  })

  test('the list fixture route is unreachable in a production build', async ({ request }) => {
    const res = await request.get('/_dev/list?view=dashboard')
    expect(res.status()).toBe(404)
    expect(await res.text()).not.toContain('Example: Testnet launch quest')
  })
})
