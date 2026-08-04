'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
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

/**
 * In-app notification center (PRD BR-N*). A bell in the header with an unread badge and a
 * dropdown list. Reads GET /api/notifications (scoped to the connected wallet's SIWE session);
 * renders nothing until a wallet is connected. No worker involved — in-app is a pure read path.
 */
export function NotificationBell() {
  const { isConnected } = useWallet()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
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

  // Poll the unread count while connected; refetch in full when the panel opens.
  useEffect(() => {
    if (!isConnected) {
      setItems([])
      setUnread(0)
      return
    }
    fetchNotifications()
    const t = setInterval(fetchNotifications, POLL_MS)
    return () => clearInterval(t)
  }, [isConnected, fetchNotifications])

  useEffect(() => {
    if (open) fetchNotifications()
  }, [open, fetchNotifications])

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
      fetchNotifications() // reconcile on failure
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
      fetchNotifications()
    }
  }

  if (!isConnected) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-medium leading-none text-background">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`px-4 py-3 text-sm ${n.read ? 'opacity-60' : 'bg-secondary/40'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{n.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{n.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => markOneRead(n.id)}
                        aria-label="Mark read"
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
