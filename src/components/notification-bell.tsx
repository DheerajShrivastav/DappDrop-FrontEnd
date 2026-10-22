'use client'

import { useCallback, useEffect, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useWallet } from '@/context/wallet-provider'

type Notification = {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

const POLL_MS = 30_000

export type NotificationsState = ReturnType<typeof useNotifications>

/**
 * In-app notification center (PRD BR-N*). Reads GET /api/notifications (scoped to the connected
 * wallet's SIWE session); empty until a wallet is connected. No worker involved — in-app is a
 * pure read path.
 *
 * 08-site: split into a hook + a list so the app header polls ONCE and shows the same state in
 * two places: the bell's popover (desktop) and the phone menu's "Notifications (n new)".
 */
export function useNotifications() {
  const { isConnected } = useWallet()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=30', { credentials: 'include' })
      if (!res.ok) {
        // 401 (no SIWE session yet) or any error — clear state, keep the bell quiet.
        setItems([])
        setUnread(0)
        return
      }
      const data = await res.json()
      setItems(data.notifications ?? [])
      setUnread(data.unreadCount ?? 0)
    } catch {
      // network hiccup — leave the last-known state
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll the unread count while connected.
  useEffect(() => {
    if (!isConnected) {
      setItems([])
      setUnread(0)
      return
    }
    refresh()
    const t = setInterval(refresh, POLL_MS)
    return () => clearInterval(t)
  }, [isConnected, refresh])

  const markAllRead = async () => {
    // Optimistic — flip locally, then persist.
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ all: true }),
      })
    } catch {
      refresh() // reconcile on failure
    }
  }

  const markOneRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnread((u) => Math.max(0, u - 1))
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: [id] }),
      })
    } catch {
      refresh()
    }
  }

  return { isConnected, items, unread, loading, refresh, markAllRead, markOneRead }
}

/** "Notifications" / "Notifications, 2 new": the state in words for the bell and the menu. */
export function notificationsLabel(unread: number): string {
  return unread > 0 ? `Notifications, ${unread} new` : 'Notifications'
}

/** The list itself (the bell's popover and the phone menu). */
export function NotificationList({ state, heading = true }: { state: NotificationsState; heading?: boolean }) {
  const { items, unread, loading, markAllRead, markOneRead } = state
  return (
    <div>
      {(heading || unread > 0) && (
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-rule px-4">
          {heading ? <span className="font-mono text-[0.75rem] uppercase tracking-[0.12em] text-ink-3">Notifications</span> : <span />}
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex min-h-11 items-center text-small text-ink-2 underline-offset-4 can-hover:hover:text-ink can-hover:hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
      )}
      <div className="max-h-96 overflow-y-auto">
        {loading && items.length === 0 ? (
          <p className="px-4 py-8 text-center text-small text-ink-2">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-small text-ink-2">You&apos;re all caught up.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {items.map((n) => (
              <li key={n.id} className="px-4 py-3 text-small">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 [overflow-wrap:anywhere]">
                    <p className={n.read ? 'leading-snug text-ink-2' : 'font-semibold leading-snug text-ink'}>
                      {!n.read && (
                        <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-signal" />
                      )}
                      {n.title}
                      {!n.read && <span className="sr-only"> (new)</span>}
                    </p>
                    <p className="mt-0.5 leading-snug text-ink-2">{n.body}</p>
                    <p className="mt-1 font-mono text-[0.75rem] text-ink-3">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markOneRead(n.id)}
                      className="inline-flex h-11 shrink-0 items-center rounded-full px-2 text-[0.8125rem] text-ink-2 can-hover:hover:text-ink"
                    >
                      Mark read<span className="sr-only">: {n.title}</span>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * The header bell: a 44 px round icon button with a gold dot when something is new (the count is
 * in its name). Renders nothing until a wallet is connected.
 */
export function NotificationBell({ state }: { state: NotificationsState }) {
  const [open, setOpen] = useState(false)
  const { isConnected, unread, refresh } = state

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  if (!isConnected) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-rule-strong text-ink can-hover:hover:border-ink"
          aria-label={notificationsLabel(unread)}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 8a5 5 0 0 1 10 0v4l1.5 2.5h-13L5 12Z" />
            <path d="M8.2 17a2 2 0 0 0 3.6 0" />
          </svg>
          {unread > 0 && (
            <span aria-hidden="true" className="absolute right-[10px] top-[9px] h-[7px] w-[7px] rounded-full bg-signal shadow-[0_0_0_2px_var(--paper)]" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] border-rule-strong p-0">
        <NotificationList state={state} />
      </PopoverContent>
    </Popover>
  )
}
