/**
 * QW-09 → 07-wow: release gates for the Monolith pages (/, /how-it-works, /security).
 * Run against a production build: npm run build && npm run test:gates
 *
 * Lighthouse (LCP/TBT/CLS/weight/requests) runs separately from lighthouserc.json; build-output
 * gates (static, first-load JS, no framer-motion/wagmi/rainbow) in scripts/check-landing-bundle.mjs;
 * contrast (both themes) in scripts/contrast-check.mjs. Build contract:
 * landing-studio/07-wow/build-contract.md.
 */
import { test, expect, type Page } from '@playwright/test'

// Playwright compiles specs to CommonJS, so require.resolve is available.
const AXE = require.resolve('axe-core/axe.min.js')

const PHONE = { width: 375, height: 812 }
// 07-wow (2026-10-13): the Monolith homepage measured 5,741 px at 375 × 812 through the end of
// #final (the footer isn't counted), with the stub <VaultStage/>. The hard cap is that + 15 %.
// (The old long page's cap was 9,000 px through #start; that content now lives on /how-it-works.)
const HEIGHT_HARD = 6600
const DOM_MAX = 1200
const WORDS_MAX = 300
const PAGES = ['/', '/how-it-works', '/security'] as const
const THEMES = ['obsidian', 'porcelain'] as const
type Theme = (typeof THEMES)[number]

async function open(page: Page, path = '/') {
  await page.goto(path, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
}

/** Sets the remembered theme before any page script runs (as a returning visitor would have it). */
async function remember(page: Page, theme: Theme) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('dd-theme', t)
    } catch {}
  }, theme)
}

/** Records the theme and the body colour at DOMContentLoaded, i.e. before the first paint. */
async function recordFirst(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      ;(window as unknown as { __first: unknown }).__first = {
        theme: document.documentElement.dataset.theme,
        bg: getComputedStyle(document.body).backgroundColor,
      }
    })
  })
}

async function axe(page: Page) {
  await page.addScriptTag({ path: AXE })
  return page.evaluate(async () => {
    // @ts-expect-error axe is injected above
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })
    return r.violations.map((v: { id: string; nodes: { target: string[] }[] }) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  })
}

const first = (page: Page) => page.evaluate(() => (window as unknown as { __first: unknown }).__first)
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme)

test.describe('static HTML', () => {
  for (const path of PAGES) {
    test(`${path}: no element is server-rendered invisible; no wallet code`, async ({ request }) => {
      const html = await (await request.get(path)).text()
      expect(html).not.toContain('style="opacity:0')
      expect(html).not.toMatch(/rainbowkit|WagmiProvider/i)
    })
  }

  test('the no-flash theme script is inline in <head>, defaults to obsidian, and ignores the OS preference', async ({ request }) => {
    const html = await (await request.get('/')).text()
    const head = html.slice(0, html.indexOf('</head>'))
    expect(head).toContain("localStorage.getItem('dd-theme')")
    expect(head).toContain("var t='obsidian'")
    expect(head).not.toContain('prefers-color-scheme')
    expect(html).toMatch(/<html[^>]*data-theme="obsidian"/)
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

  for (const path of ['/', '/how-it-works']) {
    test(`${path}: the H1 is the LCP element and is not inside #slip`, async ({ page }) => {
      await page.addInitScript(() => {
        ;(window as unknown as { __lcp: PerformanceEntry[] }).__lcp = []
        new PerformanceObserver((l) => (window as unknown as { __lcp: PerformanceEntry[] }).__lcp.push(...l.getEntries())).observe({
          type: 'largest-contentful-paint',
          buffered: true,
        })
      })
      await page.setViewportSize(PHONE)
      await open(page, path)
      const lcp = await page.evaluate(() => {
        const list = (window as unknown as { __lcp: (PerformanceEntry & { element?: Element })[] }).__lcp
        const el = list[list.length - 1]?.element
        return el ? { tag: el.tagName, inSlip: !!el.closest('#slip') } : null
      })
      expect(lcp).toEqual({ tag: 'H1', inSlip: false })
    })
  }

  test('the hero CTA goes straight to /create-campaign and prefetches it only on intent', async ({ page }) => {
    const hits: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('create-campaign')) hits.push(r.url())
    })
    await open(page)
    const cta = page.locator('#hero-cta')
    await expect(cta).toHaveAttribute('href', '/create-campaign')
    await page.waitForTimeout(1500)
    expect(hits).toEqual([])
    await cta.hover()
    await page.waitForTimeout(1500)
    expect(hits.length).toBeGreaterThan(0)
  })
})

test.describe('homepage copy and contract markup (07-wow)', () => {
  test('Monolith copy, beats in order, ≤ 300 visible words', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page)
    await expect(page.locator('h1')).toHaveText('Don’t promise rewards. Lock them in.')
    await expect(page.locator('#fund h2')).toHaveText('The reward goes in first.')
    await expect(page.locator('#prove h2')).toHaveText('24 hours to check the list.')
    await expect(page.locator('#claim h2')).toHaveText('Claimed straight to their wallets.')
    await expect(page.locator('#modes h2')).toHaveText('Pick the tasks. Pick the payout.')
    await expect(page.locator('#final h2')).toHaveText('Lock in your first reward.')
    await expect(page.locator('#trust')).toContainText('Not audited yet')
    await expect(page.locator('#trust a')).toHaveAttribute('href', '/security')
    const beats = await page.locator('main [data-beat]').evaluateAll((els) => els.map((e) => `${e.id}:${e.getAttribute('data-beat')}`))
    expect(beats).toEqual(['top:hero', 'fund:fund', 'prove:prove', 'claim:claim', 'modes:after', 'trust:after', 'final:after'])
    // Copy §0: visible tokens containing a letter or digit; screen-reader-only text excluded.
    const words = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.querySelector('main')!, NodeFilter.SHOW_TEXT)
      let n = 0
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const el = t.parentElement!
        if (el.closest('.sr-only, script') || !el.checkVisibility()) continue
        n += (t.textContent || '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
      }
      return n
    })
    console.log(`homepage: ${words} visible words in <main> at 1440`)
    expect(words).toBeLessThanOrEqual(WORDS_MAX)
  })

  test('the vault stage renders once inside <main>, before the sections, and is aria-hidden', async ({ page }) => {
    await open(page)
    const r = await page.evaluate(() => {
      const main = document.querySelector('main')!
      const stages = main.querySelectorAll('[data-vault-stage], [data-wow-stage]')
      const hero = document.getElementById('top')!
      return {
        count: stages.length,
        hidden: stages[0]?.closest('[aria-hidden="true"]') != null,
        before: !!stages[0] && !!(stages[0].compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING),
      }
    })
    expect(r).toEqual({ count: 1, hidden: true, before: true })
  })

  test('header: ≤ 4 nav items + the CTA to the app; aria-current on the subpages', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/security')
    expect(await page.locator('nav[aria-label="Main"] li a').count()).toBeLessThanOrEqual(4)
    await expect(page.locator('nav[aria-label="Main"] [data-cta="header_start"]')).toHaveAttribute('href', '/create-campaign')
    await expect(page.locator('nav[aria-label="Main"] a[href="/security"]')).toHaveAttribute('aria-current', 'page')
  })

  test('old homepage hashes redirect to their new pages', async ({ page }) => {
    await page.goto('/#faq-beta', { waitUntil: 'networkidle' })
    expect(new URL(page.url()).pathname + new URL(page.url()).hash).toBe('/how-it-works#faq-beta')
    await page.goto('/#can-cant', { waitUntil: 'networkidle' })
    expect(new URL(page.url()).pathname + new URL(page.url()).hash).toBe('/security#can-cant')
  })
})

test.describe('themes (07-wow)', () => {
  test('default is Obsidian, even when the OS prefers light; set before first paint', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'light', viewport: PHONE })
    const page = await ctx.newPage()
    await recordFirst(page)
    await open(page)
    expect(await first(page)).toEqual({ theme: 'obsidian', bg: 'rgb(5, 5, 6)' })
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark')
    await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('aria-pressed', 'false')
    await ctx.close()
  })

  test('a remembered Porcelain applies before first paint (no flash of Obsidian)', async ({ page }) => {
    await remember(page, 'porcelain')
    await recordFirst(page)
    await open(page)
    expect(await first(page)).toEqual({ theme: 'porcelain', bg: 'rgb(244, 241, 234)' })
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light')
    await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('aria-pressed', 'true')
  })

  test('the toggle switches, persists across pages and reloads, and fires dappdrop:themechange', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page)
    await page.evaluate(() => {
      const w = window as unknown as { __events: unknown[] }
      w.__events = []
      window.addEventListener('dappdrop:themechange', (e) => w.__events.push((e as CustomEvent).detail))
    })
    const toggle = page.getByRole('button', { name: 'Light theme' })
    await toggle.click()
    expect(await theme(page)).toBe('porcelain')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => (window as unknown as { __events: unknown[] }).__events)).toEqual([{ theme: 'porcelain' }])
    expect(await page.evaluate(() => localStorage.getItem('dd-theme'))).toBe('porcelain')
    await open(page, '/how-it-works')
    expect(await theme(page)).toBe('porcelain')
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(244, 241, 234)')
    await page.getByRole('button', { name: 'Light theme' }).click()
    await page.reload({ waitUntil: 'networkidle' })
    expect(await theme(page)).toBe('obsidian')
  })

  test('works with storage blocked: Obsidian, and the toggle still switches', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError')
        },
      })
    })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page)
    expect(await theme(page)).toBe('obsidian')
    await page.getByRole('button', { name: 'Light theme' }).click()
    expect(await theme(page)).toBe('porcelain')
    expect(errors).toEqual([])
  })

  test('/about stays light whatever the theme, with no toggle', async ({ page }) => {
    await open(page, '/about')
    expect(await page.evaluate(() => document.querySelector('.lp-theme'))).toBeNull()
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light')
    expect(await page.locator('[data-theme-toggle]').count()).toBe(0)
  })
})

test.describe('layout', () => {
  for (const path of PAGES) {
    for (const width of [320, 375, 390]) {
      test(`${path}: no horizontal overflow at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        await open(page, path)
        const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
        expect(sw).toBe(cw)
      })
    }
  }

  test('phone: CTA within the first 600 px, 3-line H1, page height and DOM budgets', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await open(page)
    const m = await page.evaluate(() => {
      const h1 = document.querySelector('h1')!
      return {
        ctaBottom: document.getElementById('hero-cta')!.getBoundingClientRect().bottom,
        h1Lines: Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)),
        // Through the end of #final (the footer isn't counted).
        height: Math.round(document.getElementById('final')!.getBoundingClientRect().bottom + scrollY),
        nodes: document.querySelectorAll('*').length,
      }
    })
    console.log(`homepage at 375: ${m.height} px through #final (cap ${HEIGHT_HARD}), ${m.nodes} DOM nodes`)
    expect(m.ctaBottom).toBeLessThanOrEqual(600)
    expect(m.h1Lines).toBeLessThanOrEqual(3)
    expect(m.height).toBeLessThanOrEqual(HEIGHT_HARD)
    expect(m.nodes).toBeLessThanOrEqual(DOM_MAX)
  })
})

test.describe('no JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('H1 and CTA are visible, in Obsidian', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto('/')
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('h1')!).opacity)).toBe('1')
    await expect(page.locator('#hero-cta')).toBeVisible()
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(5, 5, 6)')
  })
})

test.describe('motion', () => {
  for (const path of ['/', '/how-it-works']) {
    test(`${path}: reduced motion: no animations`, async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      await open(page, path)
      await page.mouse.wheel(0, 2500)
      await page.waitForTimeout(1500)
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
      if (path === '/how-it-works') {
        await page.getByRole('button', { name: 'Replay animation' }).click()
        await page.waitForTimeout(100)
        expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0)
      }
      await ctx.close()
    })
  }

  test('the H1 is never animated', async ({ page }) => {
    await open(page)
    expect(await page.evaluate(() => document.querySelector('h1')!.getAnimations().length)).toBe(0)
  })

  test('/how-it-works: the slip trace runs once and leaves no animations behind', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await open(page, '/how-it-works')
    await page.waitForTimeout(1300)
    expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0)
    await page.waitForTimeout(5500)
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
    await ctx.close()
  })

  test('/how-it-works: Pause is the first control in the slip, with aria-pressed', async ({ page }) => {
    await open(page, '/how-it-works')
    const btn = page.locator('#slip').locator('button, a').first()
    await expect(btn).toHaveAttribute('aria-label', 'Pause animation')
    await expect(btn).toHaveAttribute('aria-pressed', 'false')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('keyboard', () => {
  test('the skip link is the first tab stop and moves focus to main', async ({ page }) => {
    await open(page)
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Skip to main content')
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

test.describe('accessibility (axe, WCAG 2.2 AA), both themes', () => {
  for (const t of THEMES) {
    for (const [width, height] of [
      [320, 640],
      [375, 812],
      [768, 1024],
      [1440, 900],
    ]) {
      test(`/ · ${t}: 0 violations at ${width} px`, async ({ page }) => {
        await remember(page, t)
        await page.setViewportSize({ width, height })
        await open(page)
        expect(await axe(page)).toEqual([])
      })
    }
    test(`/ · ${t}: 0 violations at 375 px with reduced motion`, async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: PHONE })
      const page = await ctx.newPage()
      await remember(page, t)
      await open(page)
      expect(await axe(page)).toEqual([])
      await ctx.close()
    })
    for (const path of ['/how-it-works', '/security']) {
      for (const [width, height] of [
        [375, 812],
        [1440, 900],
      ]) {
        test(`${path} · ${t}: 0 violations at ${width} px`, async ({ page }) => {
          await remember(page, t)
          await page.setViewportSize({ width, height })
          await open(page, path)
          expect(await axe(page)).toEqual([])
        })
      }
    }
  }
})

test.describe('subpage behaviours (moved from the old homepage)', () => {
  test('deep links open their <details>: /how-it-works#faq-beta (phone)', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto('/how-it-works#faq-beta', { waitUntil: 'networkidle' })
    expect(await page.evaluate(() => (document.getElementById('faq-beta') as HTMLDetailsElement).open)).toBe(true)
  })

  test("/security: the can/can't card is open at every width", async ({ page }) => {
    for (const viewport of [PHONE, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport)
      await open(page, '/security')
      expect(await page.evaluate(() => (document.querySelector('#can-cant details') as HTMLDetailsElement).open)).toBe(true)
    }
  })

  test('/how-it-works phone collapses (founder decision 2026-10-11): closed below 768, open from 768, deep links open', async ({ page }) => {
    const states = () => page.evaluate(() => [...document.querySelectorAll<HTMLDetailsElement>('details[data-collapse-mobile]')].map((d) => d.open))
    await page.setViewportSize(PHONE)
    await open(page, '/how-it-works')
    const phone = await states()
    expect(phone.length).toBeGreaterThanOrEqual(15)
    expect(phone.every((o) => !o)).toBe(true)
    await page.setViewportSize({ width: 768, height: 1024 })
    await open(page, '/how-it-works')
    expect((await states()).every((o) => o)).toBe(true)
    await page.setViewportSize(PHONE)
    await page.goto('/how-it-works#rule-r4', { waitUntil: 'networkidle' })
    expect(await page.evaluate(() => (document.querySelector('#rule-r4 details') as HTMLDetailsElement).open)).toBe(true)
  })

  test('"Continue to the app" prefetches /create-campaign only on intent', async ({ page }) => {
    const hits: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('create-campaign')) hits.push(r.url())
    })
    await open(page, '/how-it-works')
    await page.locator('#start').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1500)
    expect(hits).toEqual([])
    await page.locator('[data-cta="continue_to_app"]').hover()
    await page.waitForTimeout(1500)
    expect(hits.length).toBeGreaterThan(0)
  })

  test('receipts point at deployed code only (explorer source or a tag, never dev)', async ({ page }) => {
    const hrefs: string[] = []
    for (const path of ['/how-it-works', '/security']) {
      await open(page, path)
      hrefs.push(...(await page.locator('[data-receipt]').evaluateAll((els) => els.map((e) => e.getAttribute('href') || ''))))
    }
    expect(hrefs.length).toBeGreaterThan(0)
    for (const h of hrefs) {
      expect(h).toMatch(/^https:\/\/(sepolia\.etherscan\.io\/address\/0x[0-9a-fA-F]{40}#code|github\.com\/.+\/blob\/v[^/]+\/)/)
      expect(h).not.toMatch(/\/(blob|tree)\/dev\//)
    }
  })

  test('no links into the old homepage anchors remain', async ({ page }) => {
    for (const path of PAGES) {
      await open(page, path)
      expect(await page.locator('a[href^="/#"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual([])
    }
  })
})
