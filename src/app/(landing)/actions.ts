'use server'

import { headers } from 'next/headers'

/**
 * S1-13: the landing lead forms' one server action (waitlist, founding-host application, exit
 * poll). Native <form> + this action; no captcha (A11): a honeypot plus a per-IP rate limit.
 *
 * Destination (founder decision): LEAD_WEBHOOK_URL, a server-only env var (e.g. a form backend or
 * a private webhook). The forms only render when a privacy notice exists (D11); if the webhook is
 * unset, the action refuses politely. Nothing here is sent to analytics (only the event name is,
 * client-side), and nothing is stored on our side.
 */
export type LeadState = {
  status: 'idle' | 'ok' | 'error'
  /** Field name → error message (shown next to the field and in the summary). */
  errors?: Record<string, string>
  message?: string
}

const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5
const hits = new Map<string, number[]>()

function limited(key: string): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 5000) hits.clear() // bounded memory; a best-effort limiter per instance
  return recent.length > MAX_PER_WINDOW
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const str = (fd: FormData, k: string, max = 300) => String(fd.get(k) ?? '').trim().slice(0, max)

const FORMS = {
  waitlist: {
    required: { email: 'Enter your email address, like you@project.xyz.' },
    optional: ['chain', 'budget'],
  },
  founding: {
    required: {
      name: 'Enter your name.',
      project: 'Enter your project’s name and a link.',
      role: 'Enter your role.',
      handle: 'Enter your X or Telegram handle.',
      reward: 'Tell us what you’d reward people for.',
      when: 'Tell us roughly when you plan to run it.',
    },
    optional: ['heard'],
  },
  poll: { required: {}, optional: ['reason'] },
} as const

export async function submitLead(_prev: LeadState, fd: FormData): Promise<LeadState> {
  const form = str(fd, 'form', 20) as keyof typeof FORMS
  const spec = FORMS[form]
  if (!spec) return { status: 'error', message: 'That didn’t send. Reload the page and try again.' }

  // Honeypot: a field people can't see. Bots fill it; pretend it worked.
  if (str(fd, 'website')) return { status: 'ok' }

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (limited(`${form}:${ip}`)) return { status: 'error', message: 'Too many tries. Wait a few minutes and try again.' }

  const errors: Record<string, string> = {}
  const data: Record<string, string> = {}
  for (const [k, msg] of Object.entries(spec.required)) {
    const v = str(fd, k)
    if (!v) errors[k] = msg
    else data[k] = v
  }
  for (const k of spec.optional) {
    const v = str(fd, k, k === 'reason' ? 1000 : 300)
    if (v) data[k] = v
  }
  if (data.email && !EMAIL.test(data.email)) errors.email = 'Enter a valid email address, like you@project.xyz.'
  if (Object.keys(errors).length) return { status: 'error', errors }

  const url = process.env.LEAD_WEBHOOK_URL
  if (!url) return { status: 'error', message: 'We’re not taking sign-ups yet. Please try again later.' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ form, data, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(String(res.status))
  } catch {
    return { status: 'error', message: 'That didn’t send. Check your connection and try again — nothing was lost.' }
  }
  return { status: 'ok' }
}
