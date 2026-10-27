'use client'

import { useRef, useState, type FormEvent } from 'react'
import { submitLead, type LeadState } from '@/app/(landing)/actions'
import { track } from '@/lib/track'

/**
 * S1-13: one native form for the waitlist, the founding-host application and the exit poll
 * (A11-crit form spec): a visible <label> per field, autocomplete, the error next to the field
 * plus a summary that takes focus, success in role="status", a honeypot, a 44 px submit that's
 * never disabled, and the privacy link beside it. Analytics gets the event only, never content.
 */
export type Field = {
  name: string
  label: string
  type?: 'text' | 'email' | 'url' | 'textarea' | 'select'
  autoComplete?: string
  placeholder?: string
  required?: boolean
  options?: string[]
}

export function LeadForm({
  form,
  fields,
  submitLabel,
  success,
  privacyUrl,
  privacyLine,
  onDark = false,
  children,
}: {
  form: 'waitlist' | 'founding' | 'poll'
  fields: Field[]
  submitLabel: string
  success: string
  privacyUrl: string
  privacyLine: string
  onDark?: boolean
  /** Rendered after a successful submit (e.g. the exit poll). */
  children?: React.ReactNode
}) {
  const [state, setState] = useState<LeadState>({ status: 'idle' })
  const [pending, setPending] = useState(false)
  const started = useRef(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pending) return
    setPending(true)
    const next = await submitLead(state, new FormData(e.currentTarget)).catch(
      (): LeadState => ({ status: 'error', message: 'That didn’t send. Check your connection and try again — nothing was lost.' }),
    )
    setPending(false)
    setState(next)
    track(next.status === 'ok' ? 'lead_form_submit' : 'lead_form_error', { form })
    if (next.status === 'error') requestAnimationFrame(() => summaryRef.current?.focus())
  }

  const muted = onDark ? 'text-paper-2' : 'text-ink-2'
  const input = `mt-1 block min-h-11 w-full rounded-sm border px-3 py-2 text-body ${
    onDark ? 'border-paper-2 bg-ink text-paper' : 'border-rule-strong bg-surface text-ink'
  } aria-[invalid=true]:border-[#8B4B56]`

  if (state.status === 'ok') {
    return (
      <div>
        <p role="status" className="text-body font-medium">
          {success}
        </p>
        {children}
      </div>
    )
  }

  const errors = state.errors ?? {}
  const errorList = Object.entries(errors)

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      onFocus={() => {
        if (!started.current) {
          started.current = true
          track('lead_form_start', { form })
        }
      }}
    >
      <input type="hidden" name="form" value={form} />
      {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {(errorList.length > 0 || state.message) && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className={`mb-4 rounded-sm border-l-4 border-[#8B4B56] px-3 py-2 text-small ${onDark ? 'bg-ink text-paper' : 'bg-surface text-ink'}`}>
          {state.message ?? 'Please fix the following:'}
          {errorList.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {errorList.map(([k, msg]) => (
                <li key={k}>
                  <a href={`#${form}-${k}`} className="lp-link">
                    {msg}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-4">
        {fields.map((f) => {
          const id = `${form}-${f.name}`
          const err = errors[f.name]
          const common = {
            id,
            name: f.name,
            required: f.required,
            'aria-invalid': err ? true : undefined,
            'aria-describedby': err ? `${id}-error` : undefined,
            className: input,
          }
          return (
            <div key={f.name}>
              <label htmlFor={id} className="block text-small font-medium">
                {f.label}
                {!f.required && <span className={`font-normal ${muted}`}> (optional)</span>}
              </label>
              {f.type === 'textarea' ? (
                <textarea {...common} rows={3} />
              ) : f.type === 'select' ? (
                <select {...common} defaultValue="">
                  <option value="">Choose one</option>
                  {f.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input {...common} type={f.type ?? 'text'} autoComplete={f.autoComplete} placeholder={f.placeholder} />
              )}
              {err && (
                <p id={`${id}-error`} className="mt-1 text-small font-medium">
                  {err}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="submit"
          className={`inline-flex h-11 items-center justify-center rounded-sm border border-transparent px-5 text-body font-semibold ${
            onDark ? 'bg-paper text-ink' : 'bg-ink text-paper'
          }`}
        >
          {pending ? 'Sending…' : submitLabel}
        </button>
        <p className={`text-small ${muted}`}>
          {privacyLine}{' '}
          <a href={privacyUrl} className="lp-link">
            Privacy notice
          </a>
        </p>
      </div>
    </form>
  )
}
