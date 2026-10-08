/**
 * QW-09: landing-page release gates (plan §5.1 QW-09; PRF and A11 gates).
 * Run against a production build: npm run build && npm run test:gates
 *
 * Lighthouse (LCP/TBT/CLS/weight/requests) runs separately from lighthouserc.json; build-output
 * gates (static, first-load JS, no framer-motion/wagmi/rainbow) in scripts/check-landing-bundle.mjs;
 * contrast in scripts/contrast-check.mjs.
 */
import { test, expect, type Page } from '@playwright/test'

// Playwright compiles specs to CommonJS, so require.resolve is available.
const AXE = require.resolve('axe-core/axe.min.js')

const PHONE = { width: 375, height: 812 }
const HEIGHT_HARD = 7300
const HEIGHT_WARN = 7000
const DOM_MAX = 1200

async function open(page: Page, path = '/') {
  await page.goto(path, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
}

test.describe('static HTML', () => {
  test('no element is server-rendered invisible', async ({ request }) => {
    const html = await (await request.get('/')).text()
    expect(html).not.toContain('style="opacity:0')
  })
})

test.describe('loading', () => {
  test('no _rsc prefetch and no app-route chunks on load', async ({ page }) => {
    const urls: string[] = []
    page.on('request', (r) => urls.push(r.url()))
    await page.setViewportSize(PHONE)
    await open(page)
    await page.waitForTimeout(1000)
    expect(urls.filter((u) => u.includes('_rsc='))).toEqual([])
    expect(urls.filter((u) => /\/app\/\(app\)\//.test(decodeURIComponent(u)))).toEqual([])
    expect(urls.filter((u) => /fonts\.g(oogleapis|static)|inter|space.?grotesk/i.test(u))).toEqual([])
  })

  test('the H1 is the LCP element and is not inside #slip', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __lcp: PerformanceEntry[] }).__lcp = []
      new PerformanceObserver((l) => (window as unknown as { __lcp: PerformanceEntry[] }).__lcp.push(...l.getEntries())).observe({
        type: 'largest-contentful-paint',
        buffered: true,
      })
    })
    await page.setViewportSize(PHONE)
    await open(page)
    const lcp = await page.evaluate(() => {
      const list = (window as unknown as { __lcp: (PerformanceEntry & { element?: Element })[] }).__lcp
      const el = list[list.length - 1]?.element
      return el ? { tag: el.tagName, inSlip: !!el.closest('#slip') } : null
    })
    expect(lcp).toEqual({ tag: 'H1', inSlip: false })
  })
})

test.describe('layout', () => {
  for (const width of [320, 375, 390]) {
    test(`no horizontal overflow at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await open(page)
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
      expect(sw).toBe(cw)
    })
  }

  test('phone: CTA within the first 600 px, 3-line H1, page height and DOM budgets', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await open(page)
    const m = await page.evaluate(() => {
      const h1 = document.querySelector('h1')!
      return {
        ctaBottom: document.getElementById('hero-cta')!.getBoundingClientRect().bottom,
        h1Lines: Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)),
        height: document.documentElement.scrollHeight,
        nodes: document.querySelectorAll('*').length,
      }
    })
    expect(m.ctaBottom).toBeLessThanOrEqual(600)
    expect(m.h1Lines).toBeLessThanOrEqual(3)
    expect(m.height).toBeLessThanOrEqual(HEIGHT_HARD)
    if (m.height > HEIGHT_WARN) console.warn(`⚠ page height ${m.height} px > ${HEIGHT_WARN} px target`)
    expect(m.nodes).toBeLessThanOrEqual(DOM_MAX)
  })

  test('status strip is at most 32 px tall at 320 and 1440', async ({ page }) => {
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 800 })
      await open(page)
      const h = await page.evaluate(() => document.querySelector('section[aria-label="Beta status"]')!.getBoundingClientRect().height)
      expect(h).toBeLessThanOrEqual(32)
    }
  })
})

test.describe('no JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('H1 and CTA are visible', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto('/')
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('h1')!).opacity)).toBe('1')
    await expect(page.locator('#hero-cta')).toBeVisible()
  })
})

test.describe('motion', () => {
  test('reduced motion: no animations, before or after a replay', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await open(page)
    await page.waitForTimeout(1500)
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
    await page.getByRole('button', { name: 'Replay animation' }).click()
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0)
    await ctx.close()
  })

  test('the trace runs once and leaves no animations behind', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await open(page)
    await page.waitForTimeout(1300)
    expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0)
    await page.waitForTimeout(5500)
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
    await ctx.close()
  })

  test('Pause is the first control in the slip, with aria-pressed', async ({ page }) => {
    await open(page)
    const first = page.locator('#slip').locator('button, a').first()
    await expect(first).toHaveAttribute('aria-label', 'Pause animation')
    await expect(first).toHaveAttribute('aria-pressed', 'false')
    await first.click()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('keyboard', () => {
  test('the skip link is the first tab stop and moves focus to main', async ({ page }) => {
    await open(page)
    await page.keyboard.press('Tab')
    const first = await page.evaluate(() => document.activeElement?.textContent?.trim())
    expect(first).toBe('Skip to main content')
    await page.keyboard.press('Enter')
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('main')
  })

  test('phone menu: opens as a modal, Esc closes it, focus returns to the trigger', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await open(page)
    const trigger = page.getByRole('button', { name: 'Menu' })
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await trigger.click()
    await expect(page.locator('#site-menu')).toBeVisible()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const linkHeights = await page.locator('#site-menu nav a').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
    expect(Math.min(...linkHeights)).toBeGreaterThanOrEqual(44)
    await page.keyboard.press('Escape')
    await expect(page.locator('#site-menu')).toBeHidden()
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-controls'))).toBe('site-menu')
  })
})

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  for (const [width, height] of [
    [320, 640],
    [375, 812],
    [1440, 900],
  ]) {
    test(`0 violations at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await open(page)
      await page.addScriptTag({ path: AXE })
      const violations = await page.evaluate(async () => {
        // @ts-expect-error axe is injected above
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })
        return r.violations.map((v: { id: string; nodes: { target: string[] }[] }) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
      })
      expect(violations).toEqual([])
    })
  }
})
