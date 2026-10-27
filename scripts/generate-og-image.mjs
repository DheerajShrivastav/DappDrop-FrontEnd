#!/usr/bin/env node
/**
 * S1-15 → 07-wow: renders the 1200×630 share cards (Obsidian, dark + gold) from HTML with the
 * landing fonts, at build-prep time only (static PNGs; nothing dynamic on /):
 *   /              → src/app/opengraph-image.png + twitter-image.png (+ .alt.txt)
 *   /how-it-works  → src/app/(landing)/how-it-works/opengraph-image.png + twitter-image.png
 *   /security      → src/app/(landing)/security/opengraph-image.png + twitter-image.png
 * The vault is drawn in CSS (glass block + abstract gold discs): no amounts, no wallet stubs, no
 * logos (copy §4.1, §5). With --still <file>, a full-bleed 1200×630 frame of the live vault scene
 * (vault on the right, as the scene frames it on desktop) replaces the CSS vault, masked on the left
 * behind the copy. Capture it from the production build at 1200×630, DPR 1, with
 * /?vaultposter&vault=high (frozen hero, no grain), the page and the in-scene labels hidden.
 * Re-run when the H1, the network or the page titles change:
 *   node scripts/generate-og-image.mjs [--network "Sepolia testnet"] [--still path/to/poster.avif] [--only about,changelog]
 * Uses Playwright's Chromium (dev dependency) or CHROME_PATH.
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null)
const net = arg('--network') ?? 'Sepolia testnet'
const still = arg('--still')
const font = (f) => readFileSync(path.join(root, 'src/fonts', f)).toString('base64')

const CARDS = [
  {
    dir: 'src/app',
    eyebrow: `Public beta · ${net}`,
    title: 'Don’t promise rewards. Lock them in.',
    alt: `DappDrop: Don’t promise rewards. Lock them in. Public beta on ${net}.`,
  },
  {
    dir: 'src/app/(landing)/how-it-works',
    eyebrow: 'How it works',
    title: 'How a campaign runs, start to finish.',
    alt: `DappDrop, how it works: how a campaign runs, start to finish. Public beta on ${net}.`,
  },
  {
    dir: 'src/app/(landing)/security',
    eyebrow: 'Security · Not audited yet',
    title: 'Check our work.',
    alt: `DappDrop security: check our work. Not audited yet. Public beta on ${net}.`,
  },
  {
    dir: 'src/app/(landing)/about',
    eyebrow: 'About',
    title: 'Quest campaigns, settled on-chain.',
    alt: `About DappDrop: quest campaigns, settled on-chain. Public beta on ${net}.`,
  },
  {
    dir: 'src/app/(landing)/changelog',
    eyebrow: 'Changelog',
    title: 'What’s shipped.',
    alt: `The DappDrop changelog: what's shipped. Public beta on ${net}.`,
  },
]
// --only about,changelog: regenerate just those cards (matched on the end of `dir`).
const only = arg('--only')?.split(',')

const vault = still
  ? `<img class="still" src="data:image/${path.extname(still).slice(1)};base64,${readFileSync(still).toString('base64')}" alt="">`
  : `<div class="stage"><div class="glow"></div><div class="glass"><div class="coins">${[0, 1, 2, 3, 4, 5]
      .map((i) => `<i style="bottom:${18 + i * 15}px"></i>`)
      .join('')}</div><div class="seam"></div></div><div class="floor"></div></div>`

const page = (c) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:N;src:url(data:font/woff2;base64,${font('newsreader-opsz72-wght300-340-latin1.woff2')}) format('woff2');font-weight:300 340}
@font-face{font-family:M;src:url(data:font/woff2;base64,${font('jetbrains-mono-wght400-500-latin1.woff2')}) format('woff2');font-weight:400 500}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;background:radial-gradient(60% 80% at 76% 40%,#16161a 0%,#050506 70%);color:#F3F1EC;font-family:-apple-system,"Segoe UI",Roboto,sans-serif;position:relative}
.copy{position:absolute;left:72px;top:64px;width:620px;height:502px;display:flex;flex-direction:column}
.wm{font-family:N;font-size:38px;letter-spacing:-.02em}
.chip{margin-top:auto;align-self:flex-start;display:inline-flex;align-items:center;gap:12px;font-family:M;font-size:17px;letter-spacing:.12em;text-transform:uppercase;color:#A6A4A0;border:1px solid #3a3a3d;border-radius:999px;padding:10px 16px}
.chip:before{content:"";width:8px;height:8px;border-radius:50%;background:#F2B45E}
h1{font-family:N;font-weight:300;font-size:76px;line-height:1;letter-spacing:-.025em;margin-top:26px}
.stage{position:absolute;right:120px;top:70px;width:300px;height:480px}
.glow{position:absolute;left:-80px;right:-80px;top:120px;height:300px;background:radial-gradient(closest-side,rgba(242,180,94,.22),transparent);filter:blur(10px)}
.glass{position:absolute;inset:0 0 40px 0;border-radius:22px;border:1.5px solid rgba(243,241,236,.55);background:linear-gradient(160deg,rgba(255,255,255,.10),rgba(255,255,255,.02) 40%,rgba(255,255,255,.05));box-shadow:inset 0 0 0 10px rgba(255,255,255,.025),inset 0 1px 0 rgba(255,255,255,.4),0 40px 80px -30px rgba(0,0,0,.9)}
.glass:after{content:"";position:absolute;left:18px;top:14px;width:2px;bottom:14px;background:linear-gradient(rgba(255,255,255,.5),transparent 70%);border-radius:2px}
.coins{position:absolute;left:50%;bottom:0;width:150px;height:140px;transform:translateX(-50%)}
.coins i{position:absolute;left:0;width:150px;height:22px;border-radius:50%;background:linear-gradient(#FFD99A,#F2B45E 45%,#9A6420);box-shadow:0 2px 0 #6d4512,0 0 24px rgba(242,180,94,.35)}
.seam{position:absolute;left:24px;right:24px;top:36%;height:2px;background:linear-gradient(90deg,transparent,#F2B45E,transparent);opacity:.85}
.floor{position:absolute;left:-60px;right:-60px;bottom:0;height:60px;background:radial-gradient(closest-side,rgba(242,180,94,.18),transparent)}
.still{position:absolute;inset:0;width:1200px;height:630px;object-fit:cover;-webkit-mask:linear-gradient(90deg,transparent 34%,#000 56%)}
</style><body>${vault}<div class="copy"><div class="wm">DappDrop</div><p class="chip">${c.eyebrow}</p><h1>${c.title}</h1></div></body>`

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } })
for (const c of CARDS.filter((c) => !only || only.some((o) => c.dir.endsWith(o)))) {
  await tab.setContent(page(c))
  await tab.evaluate(() => document.fonts.ready)
  for (const name of ['opengraph-image', 'twitter-image']) {
    const out = path.join(root, c.dir, `${name}.png`)
    await tab.screenshot({ path: out })
    writeFileSync(path.join(root, c.dir, `${name}.alt.txt`), c.alt)
    console.log(path.relative(root, out), Math.round(statSync(out).size / 1024) + ' KB')
  }
}
await browser.close()
