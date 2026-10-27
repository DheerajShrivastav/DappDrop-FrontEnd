'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import config from '@/app/config'

type Platform = 'discord' | 'telegram'
type Linked = { username: string | null } | null

/**
 * Shows the Discord / Telegram account linked to the signed-in wallet, and lets the participant
 * connect or disconnect it. The link lives on the server (Discord OAuth / Telegram Login Widget,
 * both proven by the platform); verify-task checks membership ONLY for that linked account, so
 * nothing typed here could ever stand in for someone else's.
 */
export function LinkedAccountPanel({
  platform,
  onLinkedChange,
}: {
  platform: Platform
  onLinkedChange: (linked: boolean) => void
}) {
  const [linked, setLinked] = useState<Linked>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = platform === 'discord' ? 'Discord' : 'Telegram'

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/linked-accounts', { cache: 'no-store' })
      if (res.status === 401) {
        setLinked(null)
        setError('Sign in with your wallet first.')
        return
      }
      const data = (await res.json()) as Record<Platform, Linked>
      setLinked(data[platform] ?? null)
    } catch {
      setError(`Couldn't load your ${name} connection.`)
    } finally {
      setLoading(false)
    }
  }, [platform, name])

  useEffect(() => {
    refresh()
  }, [refresh])
  useEffect(() => {
    onLinkedChange(!!linked)
  }, [linked, onLinkedChange])

  // --- Discord: OAuth in a popup; the popup only signals "done", then we re-read the server.
  const connectDiscord = () => {
    setError(null)
    setBusy(true)
    const popup = window.open('/api/auth/discord', 'discord-link', 'width=520,height=720')
    if (!popup) {
      setBusy(false)
      setError('Allow pop-ups for this site to connect Discord.')
      return
    }
    const finish = () => {
      window.removeEventListener('message', onMessage)
      clearInterval(poll)
      setBusy(false)
      refresh()
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'discord-link-result') return
      if (!e.data.ok) setError('Discord was not connected. See the pop-up for details, then try again.')
      finish()
    }
    window.addEventListener('message', onMessage)
    const poll = setInterval(() => {
      if (popup.closed) finish()
    }, 600)
  }

  // --- Telegram: official Login Widget; its signed payload is checked on the server.
  const widgetRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (platform !== 'telegram' || loading || linked || !widgetRef.current) return
    const bot = config.telegramBotUsername
    if (!bot) return
    ;(window as any).onDappDropTelegramAuth = async (user: unknown) => {
      setBusy(true)
      setError(null)
      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user),
        })
        if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Telegram was not connected.')
      } finally {
        setBusy(false)
        refresh()
      }
    }
    const s = document.createElement('script')
    s.src = 'https://telegram.org/js/telegram-widget.js?22'
    s.async = true
    s.setAttribute('data-telegram-login', bot)
    s.setAttribute('data-size', 'medium')
    s.setAttribute('data-request-access', 'write')
    s.setAttribute('data-onauth', 'onDappDropTelegramAuth(user)')
    const host = widgetRef.current
    host.innerHTML = ''
    host.appendChild(s)
    return () => {
      host.innerHTML = ''
    }
  }, [platform, loading, linked, refresh])

  const disconnect = async () => {
    setBusy(true)
    try {
      await fetch(`/api/auth/linked-accounts?platform=${platform}`, { method: 'DELETE' })
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const Icon = platform === 'discord' ? MessageSquare : Send
  return (
    <div className="w-full space-y-3 rounded-lg border p-4">
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking your {name} connection…
        </p>
      ) : linked ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {name} connected{linked.username ? <> as <strong>{linked.username}</strong></> : null}
            </span>
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={disconnect} disabled={busy}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Connect your {name} account. We check membership for this account only, and it can be
            linked to one wallet at a time.
          </p>
          {platform === 'discord' ? (
            <Button type="button" onClick={connectDiscord} disabled={busy} className="w-full">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
              Connect Discord
            </Button>
          ) : config.telegramBotUsername ? (
            <div ref={widgetRef} className="flex min-h-10 justify-center" />
          ) : (
            <p className="text-sm text-destructive">Telegram sign-in isn&apos;t configured on this site.</p>
          )}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
