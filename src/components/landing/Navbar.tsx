'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const primaryLinks = [
  { label: 'Product', href: '/#features' },
  { label: 'Playbook', href: '/#how-it-works' },
  { label: 'Benefits', href: '/#benefits' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

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
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="group flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white font-semibold text-slate-900 shadow-sm">
              DD
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500 group-hover:text-slate-700 transition-colors">
              DAppDrop
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {primaryLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Dashboard
            </Link>
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
              className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-700"
            >
              Launch a campaign
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
