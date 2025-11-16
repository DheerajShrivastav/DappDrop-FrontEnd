'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/header'

const HIDDEN_PATHS = ['/', '/landing', '/about', '/changelog']

export default function HeaderVisibility() {
  const pathname = usePathname()
  const normalizedPath = pathname?.toLowerCase() ?? '/'

  if (HIDDEN_PATHS.includes(normalizedPath)) {
    return null
  }

  return <Header />
}
