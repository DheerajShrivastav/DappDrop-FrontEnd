import type { Metadata } from 'next'
import { LegacyHome } from './legacy-home'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function Home() {
  return <LegacyHome />
}
