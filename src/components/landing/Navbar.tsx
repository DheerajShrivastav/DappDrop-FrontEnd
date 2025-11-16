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

const navLinks = [
  { label: 'Product', href: '/#features' },
  { label: 'About', href: '/about' },
  { label: 'Playbook', href: '/#how-it-works' },
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
      className={`fixed inset-x-0 top-0 z-50 flex justify-center px-4 py-5 transition-all duration-500 ${
        scrolled ? 'backdrop-blur-2xl' : 'backdrop-blur-xl'
      }`}
    >
      <div className="pointer-events-auto relative w-full max-w-6xl">
        <div className="relative flex items-center justify-between gap-4 rounded-3xl border border-white/50 bg-white/60 px-6 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl before:absolute before:inset-0 before:-z-10 before:rounded-[26px] before:bg-gradient-to-r before:from-sky-200/60 before:via-blue-100/40 before:to-indigo-200/60 before:opacity-80 after:absolute after:-inset-[1px] after:-z-20 after:rounded-[28px] after:bg-gradient-to-r after:from-sky-300/40 after:via-white/0 after:to-indigo-300/40 after:blur-xl">
          <Link href="/" className="group flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white text-base font-semibold text-slate-900 shadow-inner shadow-white/40">
              DD
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-600 transition-colors group-hover:text-slate-900">
              DAppDrop
            </span>
          </Link>

          <div className="hidden flex-1 items-center justify-center gap-6 text-sm font-medium md:flex">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-slate-600 transition-all hover:text-slate-900 hover:drop-shadow-[0_2px_8px_rgba(59,130,246,0.55)]"
              >
                {item.label}
              </Link>
            ))}
            {role === 'host' && (
              <Link
                href="/dashboard"
                className="text-slate-600 transition-all hover:text-slate-900 hover:drop-shadow-[0_2px_8px_rgba(59,130,246,0.55)]"
              >
                Dashboard
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/#campaigns"
              className="hidden rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-sky-200 hover:text-slate-900 sm:inline-flex"
            >
              Explore live
            </Link>
            

            {isConnected && address ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:border-sky-200 hover:text-slate-900"
                  >
                    <Wallet className="mr-2 h-4 w-4 text-sky-500" />
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
                variant="ghost"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(59,130,246,0.45)] transition-all hover:shadow-[0_16px_45px_rgba(59,130,246,0.55)]"
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
