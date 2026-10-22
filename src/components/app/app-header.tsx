'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import appConfig from '@/app/config'
import { network, networkLabel, repos } from '@/config/landing'
import { useWallet } from '@/context/wallet-provider'
import { MenuDialog } from '@/components/landing/menu-dialog'
import { ThemeToggle } from '@/components/landing/theme-toggle'
import { Wordmark } from '@/components/landing/wordmark'
import { NotificationBell, NotificationList, notificationsLabel, useNotifications } from '@/components/notification-bell'
import { AccountPill } from './account-pill'
import { shortAddress } from './format'

type NavItem = { label: string; href: string; app: boolean; current?: (path: string) => boolean }

/** Desktop nav (app-design §1.4): Campaigns · Dashboard (hosts) · How it works · Security. */
function navItems(isHost: boolean): NavItem[] {
  return [
    { label: 'Campaigns', href: '/campaigns', app: true, current: (p) => p === '/campaigns' || p.startsWith('/campaign/') },
    ...(isHost ? [{ label: 'Dashboard', href: '/dashboard', app: true, current: (p: string) => p === '/dashboard' }] : []),
    { label: 'How it works', href: '/how-it-works', app: false },
    { label: 'Security', href: '/security', app: false },
  ]
}

/** Extra links in the phone menu only. */
const MENU_EXTRA = [
  { label: 'FAQ', href: '/how-it-works#faq' },
  { label: 'About', href: '/about' },
  { label: 'Changelog', href: '/changelog' },
] as const

/**
 * An app route: next/link (client navigation keeps the wallet providers mounted), never
 * prefetched. A marketing route: a plain <a> (a full load of a static, wallet-free page).
 */
function NavLink({ item, className, path }: { item: NavItem; className: string; path: string }) {
  const current = item.current?.(path) ? 'page' : undefined
  return item.app ? (
    <Link href={item.href} prefetch={false} className={className} aria-current={current}>
      {item.label}
    </Link>
  ) : (
    <a href={item.href} className={className} aria-current={current}>
      {item.label}
    </a>
  )
}

const outlinePill =
  'inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-rule-strong px-4 text-small font-medium leading-none text-ink transition-colors [transition-duration:var(--dur-micro)] can-hover:hover:border-ink'
const filledPill =
  'inline-flex h-12 items-center justify-center rounded-full border border-transparent bg-ink px-6 text-body font-medium leading-none text-paper transition-colors [transition-duration:var(--dur-micro)] can-hover:hover:bg-ink-2'

/**
 * The shared app header (08-site phase 1; app-design §1.4). The marketing header's language
 * (wordmark, ● Testnet, hairline, the sun/moon toggle, the native <dialog> phone menu) with the
 * app's items. Desktop (≥ 1024): wordmark · ● Testnet · nav · [New campaign] (hosts) · bell ·
 * account pill · toggle. Phone: wordmark · ● · account pill · toggle · Menu.
 */
export function AppHeader() {
  const path = usePathname() || '/'
  const { role } = useWallet()
  const isHost = role === 'host'
  const items = navItems(isHost)
  const notifications = useNotifications()
  const showNewCampaign = isHost && path !== '/create-campaign' && path !== '/dashboard'

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper" data-app-header>
      <div className="lp-container flex h-16 items-center gap-1.5 sm:gap-3">
        <a href="/" className="flex min-w-0 shrink items-baseline text-ink" aria-label="DappDrop home">
          <Wordmark className="whitespace-nowrap max-[359px]:text-[1.25rem]" />
        </a>

        {network.testnet && (
          <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-eyebrow uppercase text-ink-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal" />
            {/* Text at ≥ 440 px; below that the dot keeps an accessible name. */}
            <span className="sr-only min-[440px]:not-sr-only">Testnet</span>
          </span>
        )}

        <nav aria-label="Main" className="ml-auto hidden items-center lg:flex">
          <ul className="flex items-center gap-6">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} path={path} className="dd-nav-link" />
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 min-[360px]:gap-1.5 sm:gap-2 lg:ml-3">
          {showNewCampaign && (
            <Link href="/create-campaign" prefetch={false} className={`${outlinePill} max-lg:hidden`}>
              New campaign
            </Link>
          )}
          <span className="max-lg:hidden">
            <NotificationBell state={notifications} />
          </span>
          <AccountPill />
          <ThemeToggle />
          <span className="lg:hidden">
            <MenuDialog>
              <nav aria-label="Menu" className="px-5 py-2">
                <ul>
                  {items.map((item) => (
                    <li key={item.href} className="border-b border-rule">
                      <NavLink item={item} path={path} className="flex min-h-11 items-center py-2 text-body text-ink aria-[current=page]:underline aria-[current=page]:underline-offset-4" />
                    </li>
                  ))}
                  {MENU_EXTRA.map((l) => (
                    <li key={l.href} className="border-b border-rule">
                      <a href={l.href} className="flex min-h-11 items-center py-2 text-body text-ink">
                        {l.label}
                      </a>
                    </li>
                  ))}
                  <li className="border-b border-rule">
                    <a href={repos.app} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center py-2 text-body text-ink">
                      GitHub <span aria-hidden="true">&nbsp;↗</span>
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                </ul>
                <MenuAccount notifications={notifications} />
                <Link href="/create-campaign" prefetch={false} className={`${filledPill} mt-5 w-full`}>
                  {isHost ? 'New campaign' : 'Start a campaign'}
                </Link>
              </nav>
            </MenuDialog>
          </span>
        </div>
      </div>
      <NetworkNotice />
    </header>
  )
}

/** The phone menu's account block: the address, Copy, Notifications (n new), Disconnect. */
function MenuAccount({ notifications }: { notifications: ReturnType<typeof useNotifications> }) {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()
  const [copied, setCopied] = useState(false)

  if (!isConnected || !address) {
    return (
      <div className="mt-5">
        <p className="font-mono text-[0.75rem] uppercase tracking-[0.12em] text-ink-3">Your wallet</p>
        <p className="mt-2 text-small text-ink-2">Not connected.</p>
        <button type="button" onClick={openConnectModal} className={`${outlinePill} mt-3 w-full`}>
          Connect wallet
        </button>
      </div>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the full address is in the title for manual copy.
    }
  }

  return (
    <div className="mt-5">
      <p className="font-mono text-[0.75rem] uppercase tracking-[0.12em] text-ink-3">Your wallet</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="font-mono text-small text-ink" title={address}>
          {shortAddress(address)}
        </span>
        <button type="button" onClick={copy} className="inline-flex h-11 items-center px-1 text-small text-ink-2 underline underline-offset-4 can-hover:hover:text-ink">
          {copied ? 'Copied' : 'Copy'}
          <span className="sr-only"> the wallet address</span>
        </button>
      </div>
      <span role="status" className="sr-only">
        {copied ? 'Address copied' : ''}
      </span>
      <details className="lp-details mt-2 rounded-lg border border-rule">
        <summary className="flex min-h-11 items-center justify-between gap-3 px-4 text-small text-ink">
          <span>
            Notifications
            {notifications.unread > 0 && <span className="ml-1 font-mono text-signal">({notifications.unread} new)</span>}
            <span className="sr-only">{notifications.unread > 0 ? '' : ', none new'}</span>
          </span>
          <span aria-hidden="true" className="lp-chevron text-ink-3">
            ›
          </span>
        </summary>
        <div className="border-t border-rule" aria-label={notificationsLabel(notifications.unread)} role="region">
          <NotificationList state={notifications} heading={false} />
        </div>
      </details>
      <button type="button" onClick={() => disconnect()} className={`${outlinePill} mt-3 w-full`}>
        Disconnect
      </button>
    </div>
  )
}

/**
 * One line under the header when the wallet is on another network (app-design §1.4):
 * "You're on Ethereum. DappDrop runs on Sepolia testnet. [Switch network]".
 */
function NetworkNotice() {
  const { isConnected, chainId, chain } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  if (!isConnected || chainId === undefined || chainId === appConfig.chainId) return null
  const current = chain?.name ?? `network ${chainId}`
  return (
    <div className="border-t border-rule bg-surface" data-network-notice>
      <p className="lp-container flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-small text-ink-2">
        <span aria-hidden="true" className="font-mono font-semibold text-signal">
          !
        </span>
        <span>
          You&apos;re on {current}. DappDrop runs on {networkLabel}.
        </span>
        <button
          type="button"
          onClick={() => switchChain({ chainId: appConfig.chainId })}
          disabled={isPending}
          className="inline-flex min-h-11 items-center text-small font-medium text-ink underline decoration-rule-strong underline-offset-4 can-hover:hover:decoration-signal disabled:text-ink-3"
        >
          {isPending ? 'Check your wallet…' : 'Switch network'}
        </button>
      </p>
    </div>
  )
}
