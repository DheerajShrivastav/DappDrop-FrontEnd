'use client'

import { useEffect } from 'react'

/**
 * Upgrades the server's <title> once the client knows more ("Campaign #12 · DappDrop" →
 * "Community week · DappDrop"). Pass null/undefined while loading; the server title stays.
 */
export function useDocumentTitle(name: string | null | undefined) {
  useEffect(() => {
    const clean = name?.trim()
    if (!clean) return
    const prev = document.title
    document.title = `${clean} · DappDrop`
    return () => {
      document.title = prev
    }
  }, [name])
}
