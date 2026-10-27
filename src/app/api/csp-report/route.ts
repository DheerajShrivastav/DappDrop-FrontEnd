import { NextResponse } from 'next/server'

// QW-08: receives Content-Security-Policy-Report-Only violation reports for the landing page,
// so "0 reports over 7 days, then enforce" can be checked in the server logs.
// It stores nothing and echoes nothing; it logs a few fields, size-capped.
const MAX_BYTES = 16 * 1024

export async function POST(req: Request) {
  try {
    const text = (await req.text()).slice(0, MAX_BYTES)
    const body = JSON.parse(text) as Record<string, unknown>
    // Legacy report-uri format: { "csp-report": {...} }. Reporting API: [{ body: {...} }].
    const reports = Array.isArray(body) ? body.map((r) => (r as { body?: unknown }).body) : [body['csp-report']]
    for (const r of reports.slice(0, 10)) {
      if (!r || typeof r !== 'object') continue
      const o = r as Record<string, unknown>
      const pick = (k: string) => String(o[k] ?? '').slice(0, 200)
      console.warn('[csp-report]', JSON.stringify({
        directive: pick('violated-directive') || pick('effectiveDirective'),
        blocked: pick('blocked-uri') || pick('blockedURL'),
        document: pick('document-uri') || pick('documentURL'),
        source: pick('source-file') || pick('sourceFile'),
        line: pick('line-number') || pick('lineNumber'),
      }))
    }
  } catch {
    // Malformed reports are ignored.
  }
  return new NextResponse(null, { status: 204 })
}
