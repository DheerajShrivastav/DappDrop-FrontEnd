'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { normalizeXHandle } from '@/lib/x-task-fields'

/**
 * The participant's X handle — saved once per wallet and prefilled everywhere after. It is NOT
 * verified on its own (hosts see it labelled as such); proof-by-post is what checks it, by
 * comparing it to the real author of the post.
 */
export function XHandleField({
  required,
  onSavedChange,
}: {
  required?: boolean
  onSavedChange?: (handle: string | null) => void
}) {
  const [saved, setSaved] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="space-y-1.5">
      <Label htmlFor="x-handle">
        Your X handle{' '}
        <span className="font-normal text-muted-foreground">
          {required ? '(must match your post)' : '(optional · not verified · shown to the host)'}
        </span>
      </Label>
      <div className="flex gap-2">
        <Input
          id="x-handle"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="@you"
          autoComplete="off"
          disabled={loading}
          className="min-w-0"
        />
        <Button type="button" variant="outline" onClick={save} disabled={loading || saving || !dirty || !draft.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved && !dirty ? 'Saved' : 'Save'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
