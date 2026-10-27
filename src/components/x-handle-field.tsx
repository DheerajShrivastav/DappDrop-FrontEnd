'use client'

import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/app/button'
import { InlineError, Input } from '@/components/app/field'
import { normalizeXHandle } from '@/lib/x-task-fields'

/**
 * The participant's X handle, saved once per wallet and prefilled everywhere after. It is NOT
 * verified on its own (hosts see it labelled as such); proof-by-post is what checks it, by
 * comparing it to the real author of the post.
 *
 * Monolith design (launch/v0.7.0): the app field (label, help, 48 px control) with [Save handle]
 * beside it, and "✓ Saved" in words once the saved handle matches what's typed.
 */
export function XHandleField({ required, onSavedChange }: { required?: boolean; onSavedChange?: (handle: string | null) => void }) {
  const [saved, setSaved] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const auto = useId()
  const id = `xh${auto.replace(/:/g, '')}`

  useEffect(() => {
    let cancelled = false
    fetch('/api/profile/x-handle', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { xHandle: null }))
      .then((d) => {
        if (cancelled) return
        setSaved(d.xHandle ?? null)
        setDraft(d.xHandle ? `@${d.xHandle}` : '')
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    onSavedChange?.(saved)
  }, [saved, onSavedChange])

  const normalized = normalizeXHandle(draft)
  const dirty = (normalized ?? null) !== saved

  const save = async () => {
    if (!normalized) {
      setError('Enter a valid X handle (letters, numbers, _; up to 15).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/x-handle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xHandle: normalized }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error || 'Could not save your handle.')
      else {
        setSaved(d.xHandle)
        setDraft(`@${d.xHandle}`)
      }
    } finally {
      setSaving(false)
    }
  }

  const helpId = `${id}-help`
  const errorId = `${id}-error`
  return (
    <div className="grid content-start gap-[0.45rem]" data-x-handle={loading ? 'loading' : saved && !dirty ? 'saved' : 'unsaved'}>
      <label htmlFor={id} className="text-[0.9375rem] font-semibold text-ink">
        Your X handle
        {!required && <span className="ml-1.5 text-[0.8125rem] font-normal text-ink-3">(optional)</span>}
      </label>
      <p id={helpId} className="-mt-0.5 text-[0.8125rem] leading-snug text-ink-2">
        {required ? 'It must match the author of your post.' : 'Not verified. The host sees it next to your wallet.'}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && dirty && draft.trim()) {
              e.preventDefault()
              save()
            }
          }}
          placeholder="@you"
          autoComplete="off"
          spellCheck={false}
          disabled={loading}
          aria-describedby={error ? `${helpId} ${errorId}` : helpId}
          aria-invalid={error ? true : undefined}
          className="min-w-0 flex-1 basis-40"
        />
        {saved && !dirty ? (
          <span className="font-mono text-[0.8125rem] text-ink-2" role="status">
            <span aria-hidden="true" className="mr-1 text-signal">
              ✓
            </span>
            Saved
          </span>
        ) : (
          <Button variant="secondary" size="sm" onClick={save} loading={saving} disabled={loading || !draft.trim()} disabledReason={loading ? undefined : 'Type your handle first.'}>
            {saving ? 'Saving…' : 'Save handle'}
          </Button>
        )}
      </div>
      {error && <InlineError id={errorId}>{error}</InlineError>}
    </div>
  )
}
