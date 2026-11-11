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

// ---------------------------------------------------------------------------------------------
// Dev fixture (only with GATES_DEV_URL): #45's X task fields in the redesigned wizard.
// ---------------------------------------------------------------------------------------------
const DEV = process.env.GATES_DEV_URL

test.describe('/create-campaign fixtures (dev server)', () => {
  test.skip(!DEV, 'set GATES_DEV_URL to a dev server to gate the wallet-only wizard states')
  test.describe.configure({ timeout: 180_000 })

  // The last task editor's index per state (the editors load on step 2, after the route).
  const LAST_EDITOR: Record<string, number> = { 'tasks-x': 2, 'tasks-community': 1, 'tasks-community-unset': 1 }
  for (const [state, last] of Object.entries(LAST_EDITOR)) {
    for (const t of THEMES) {
      for (const [width, height] of [
        [375, 812],
        [1440, 900],
      ]) {
        test(`${state} · ${t} · ${width} px: full-page axe 0, no horizontal scroll`, async ({ page }) => {
          await remember(page, t)
          await page.setViewportSize({ width, height })
          await page.goto(`${DEV}/_dev/create-campaign?state=${state}`, { waitUntil: 'load', timeout: 120_000 })
          await page.locator(`[data-task-editor="${last}"]`).waitFor({ timeout: 60_000 })
          await page.evaluate(() => document.fonts.ready)
          expect(await axe(page)).toEqual([])
          const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
          expect(sw).toBe(cw)
        })
      }
    }
  }

  test('tasks-x: the follow handle, like post link and post text fields, with their errors on Continue', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${DEV}/_dev/create-campaign?state=tasks-x`, { waitUntil: 'load', timeout: 120_000 })
    await page.locator('[data-task-editor="2"]').waitFor({ timeout: 60_000 })
    await expect(page.locator('[data-task-editor="0"]').getByLabel('X handle to follow')).toHaveValue('@example')
    const like = page.locator('[data-task-editor="1"]').getByLabel('Post link')
    await expect(like).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('[data-task-editor="1"]')).toContainText('Paste the post link')
    const post = page.locator('[data-task-editor="2"]').getByLabel('The post must include')
    await expect(post).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('[data-task-editor="2"]')).toContainText('Post checked by our app')
    // The fixed values clear the errors.
    await like.fill('https://x.com/example/status/1234567890')
    await post.fill('#ExampleWeek')
    await page.getByRole('button', { name: /Continue/ }).first().click()
    // Valid X fields: Continue moves on to the rewards step.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What do they get?')
  })

  // Post-launch polish: hosts see how to add the DappDrop bots, and why; invite links are checked.
  test('tasks-community: the bot invite and the Telegram bot username, with why; valid invite links pass', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${DEV}/_dev/create-campaign?state=tasks-community`, { waitUntil: 'load', timeout: 120_000 })
    await page.locator('[data-task-editor="1"]').waitFor({ timeout: 60_000 })
    const discord = page.locator('[data-task-editor="0"]')
    await expect(discord).toContainText('Our bot checks membership')
    const add = discord.getByRole('link', { name: 'Add the DappDrop bot to your server (opens in a new tab)' })
    await expect(add).toHaveAttribute('href', 'https://discord.com/oauth2/authorize?client_id=100000000000000001&permissions=1024&scope=bot')
    await expect(add).toHaveAttribute('target', '_blank')
    await expect(discord).not.toContainText('Discord checks won’t work yet')
    await expect(discord.getByLabel('Discord invite link')).not.toHaveAttribute('aria-invalid', 'true')
    const telegram = page.locator('[data-task-editor="1"]')
    await expect(telegram).toContainText('Our bot checks membership')
    await expect(telegram).toContainText('Add @ExampleDappDropBot to your channel or group.')
    await expect(telegram.getByRole('link', { name: 'Open @ExampleDappDropBot (opens in a new tab)' })).toHaveAttribute('href', 'https://t.me/ExampleDappDropBot')
    // A bare Discord code and a t.me/+ link are valid: Continue moves on to the rewards step.
    await page.getByRole('button', { name: /Continue/ }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What do they get?')
  })

  test('tasks-community-unset: says the bots aren’t set up, and refuses links that aren’t invites', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${DEV}/_dev/create-campaign?state=tasks-community-unset`, { waitUntil: 'load', timeout: 120_000 })
    await page.locator('[data-task-editor="1"]').waitFor({ timeout: 60_000 })
    const discord = page.locator('[data-task-editor="0"]')
    await expect(discord).toContainText('Discord checks won’t work yet')
    await expect(discord).toContainText('The Discord bot invite link isn’t configured.')
    await expect(discord.getByRole('link', { name: /Add the DappDrop bot/ })).toHaveCount(0)
    await expect(discord.getByLabel('Discord invite link')).toHaveAttribute('aria-invalid', 'true')
    await expect(discord).toContainText('Use a Discord invite link, like https://discord.gg/yourcode.')
    const telegram = page.locator('[data-task-editor="1"]')
    await expect(telegram).toContainText('Telegram checks won’t work yet')
    await expect(telegram.getByRole('link', { name: /Open @/ })).toHaveCount(0)
    await expect(telegram.getByLabel('Telegram invite link')).toHaveAttribute('aria-invalid', 'true')
    await expect(telegram).toContainText('Use a Telegram link, like https://t.me/yourgroup')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What should people do?')
  })
})
