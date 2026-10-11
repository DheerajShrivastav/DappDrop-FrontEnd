#!/usr/bin/env node
/**
 * S1-15 / AS-6: renders the 1200×630 share card from HTML with the landing fonts, into
 * src/app/opengraph-image.png and twitter-image.png (+ .alt.txt). Never built from
 * public/banner.png. Re-run when the H1, the network or the 24-hour line changes:
 *   node scripts/generate-og-image.mjs [--network "Sepolia testnet"]
 * Uses Playwright's Chromium (dev dependency) or CHROME_PATH.
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const net = (process.argv.includes('--network') ? process.argv[process.argv.indexOf('--network') + 1] : 'Sepolia testnet').toUpperCase()
const font = (f) => readFileSync(path.join(root, 'src/fonts', f)).toString('base64')
const H1 = 'Quest campaigns with the reward locked in up front.'
const LINE = 'Reward lists are public for 24 hours before claims open.'
const ALT = `DappDrop: “${H1}” Beside it, an example escrow statement on ${net.toLowerCase()} with the reward list public for 24 hours before claims open.`

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:N;src:url(data:font/woff2;base64,${font('newsreader-opsz72-wght450-latin1.woff2')}) format('woff2');font-weight:450}
@font-face{font-family:M;src:url(data:font/woff2;base64,${font('jetbrains-mono-wght400-500-latin1.woff2')}) format('woff2');font-weight:400 500}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#F6F4EF;color:#171717;font-family:-apple-system,"Segoe UI",Roboto,sans-serif;display:grid;grid-template-columns:600px 1fr;gap:48px;padding:64px 64px}
.wm{font-family:N;font-weight:450;font-size:40px;letter-spacing:-.02em}
h1{font-family:N;font-weight:450;font-size:60px;line-height:1.04;letter-spacing:-.02em;margin-top:48px}
.line{margin-top:28px;font-size:24px;line-height:1.4;color:#4F4B45}
.slip{background:#fff;border-radius:4px;box-shadow:0 1px 1px rgb(23 23 23/.04),0 28px 56px -28px rgb(23 23 23/.22);padding:28px 28px 24px;align-self:center;font-size:17px}
.eb{font-family:M;font-size:14px;letter-spacing:.08em;text-transform:uppercase}
.wmk{margin:14px -28px 10px;background:#ECE8DF;text-align:center;padding:6px 0;font-family:M;font-size:14px;letter-spacing:.08em;color:#4F4B45}
.row{display:flex;justify-content:space-between;gap:16px;white-space:nowrap;padding:9px 0;border-bottom:1px solid #DCD6CA}
.row b{font-family:M;font-weight:500}
.tot{border-top:3px double #171717;border-bottom:3px double #171717;font-weight:600}
.h24{margin-top:14px;font-family:M;font-size:20px;font-weight:500;color:#2338C6;border-bottom:3px solid #2338C6;display:inline-block;padding-bottom:4px}
.sub{margin-top:8px;color:#4F4B45;font-size:15px}
</style><body><div><div class="wm">DappDrop</div><h1>${H1}</h1><p class="line">${LINE}</p></div>
<div class="slip"><div class="eb">Escrow statement</div><div class="wmk">EXAMPLE · ${net}</div>
<div class="row"><span>Platform fee</span><b>None during beta</b></div>
<div class="row tot"><span>Escrowed for rewards</span><b>1,000 EXAMPLE</b></div>
<div class="h24">List public · 24 h</div><p class="sub">Then claims open. 30 days after you close it, take back what’s left.</p></div></body>`

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
await page.evaluate(() => document.fonts.ready)
for (const name of ['opengraph-image', 'twitter-image']) {
  const out = path.join(root, 'src/app', `${name}.png`)
  await page.screenshot({ path: out })
  writeFileSync(path.join(root, 'src/app', `${name}.alt.txt`), ALT)
  console.log(out, Math.round(statSync(out).size / 1024) + ' KB')
}
await browser.close()
