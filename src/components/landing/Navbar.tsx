'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useWallet } from '@/context/wallet-provider'
import { truncateAddress } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LayoutDashboard, LogOut, Wallet } from 'lucide-react'

const primaryLinks = [
  { label: 'Product', href: '/#features' },
  { label: 'Playbook', href: '/#how-it-works' },
  { label: 'Benefits', href: '/#benefits' },
]

const siteLinks = [
  { label: 'About', href: '/about' },
  { label: 'Changelog', href: '/changelog' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const { isConnected, address, connectWallet, disconnectWallet, role } = useWallet()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#f6f2eb]/90 backdrop-blur-xl border-b border-slate-200/60 shadow-sm'
          : 'bg-gradient-to-b from-[#f6f2eb] via-[#f6f2eb]/80 to-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-6">
          <Link href="/" className="group flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white font-semibold text-slate-900 shadow-sm">
              DD
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500 transition-colors group-hover:text-slate-700">
              DAppDrop
            </span>
          </Link>

          <div className="hidden flex-1 items-center justify-center gap-8 md:flex">
            {primaryLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-6 lg:flex">
            {siteLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
            {role === 'host' && (
              <Link
                href="/dashboard"
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                Dashboard
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/#campaigns"
              className="hidden sm:inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:border-slate-400 hover:text-slate-900"
            >
              Explore live
            </Link>
            <Link
              href="/#campaigns"
              className="hidden md:inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-700"
            >
              Launch a campaign
            </Link>

            {isConnected && address ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900">
                    <Wallet className="mr-2 h-4 w-4" />
                    {truncateAddress(address)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    My Wallet
                    <Badge variant="secondary" className="uppercase">
                      {role ?? 'guest'}
                    </Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {role === 'host' && (
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/dashboard">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={disconnectWallet}
                    className="cursor-pointer text-red-500 focus:text-red-500"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={connectWallet}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-700"
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
