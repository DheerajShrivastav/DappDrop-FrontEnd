/**
 * 08-site phase 2 (builder C): /create-campaign gates against a production build.
 * Without a wallet the route shows the host gate (app-design §2.4), so this is what CI can see:
 * full-page axe 0 in both themes at 320/375/768/1440, no horizontal scroll, the gate's copy and
 * keyboard path, and the dev fixture (/_dev/create-campaign) being unreachable in production.
 * The wallet-only wizard states are checked on the dev fixture (see phase2-C-handoff.md).
 */
import { test, expect, type Page } from '@playwright/test'

const AXE = require.resolve('axe-core/axe.min.js')
const THEMES = ['obsidian', 'porcelain'] as const

async function remember(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('dd-theme', t)
    } catch {}
  }, theme)
}

/** App routes never reach networkidle (WalletConnect): wait for the hydrated account pill. */
async function openApp(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'load' })
  await page.locator('[data-account-pill]:not([data-account-pill="loading"])').first().waitFor({ state: 'attached', timeout: 15_000 })
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

test.describe('/create-campaign (08-site phase 2)', () => {
  for (const t of THEMES) {
    for (const [width, height] of [
      [320, 640],
      [375, 812],
      [768, 1024],
      [1440, 900],
    ]) {
      test(`host gate · ${t}: full-page axe 0 and no horizontal overflow at ${width} px`, async ({ page }) => {
        await remember(page, t)
        await page.setViewportSize({ width, height })
        await openApp(page, '/create-campaign')
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Two steps before your first campaign.')
        expect(await axe(page)).toEqual([])
        const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
        expect(sw).toBe(cw)
      })
    }
  }

  test('host gate: Connect inside the gate, step 02 disabled with its reason, the costs in words', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openApp(page, '/create-campaign')
    const steps = page.locator('[data-host-gate-steps] > li')
    await expect(steps).toHaveCount(3)
    await expect(steps.nth(0)).toHaveAttribute('aria-current', 'step')
    await expect(steps.nth(0).getByRole('button', { name: 'Connect wallet' })).toBeVisible()
    const role = steps.nth(1).getByRole('button', { name: 'Get the host role' })
    await expect(role).toBeDisabled()
    await expect(steps.nth(1)).toContainText('Connect a wallet first.')
    await expect(steps.nth(1)).toContainText('You pay only the network gas')
    const costs = page.getByRole('complementary', { name: 'What hosting costs' })
    await expect(costs).toContainText('Host role')
    await expect(costs).toContainText('None during beta')
    // No jargon from the old gate.
    expect(await page.locator('main').innerText()).not.toMatch(/HOST_ROLE|Permissionless/)
  })

  test('host gate: keyboard reaches Connect wallet inside the gate and opens the wallet dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openApp(page, '/create-campaign')
    const connect = page.locator('[data-host-gate-steps]').getByRole('button', { name: 'Connect wallet' })
    await connect.focus()
    await expect(connect).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 })
  })

  test('the create-campaign fixture is unreachable in a production build', async ({ request }) => {
    const res = await request.get('/_dev/create-campaign?state=tasks')
    expect(res.status()).toBe(404)
    expect(await res.text()).not.toContain('Create-campaign fixture')
  })
})
