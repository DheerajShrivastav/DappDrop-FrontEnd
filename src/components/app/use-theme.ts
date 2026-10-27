'use client'

import { useEffect, useState } from 'react'
import { THEME_EVENT, type Theme } from '@/components/landing/theme'

function read(): Theme {
  return document.documentElement.dataset.theme === 'porcelain' ? 'porcelain' : 'obsidian'
}

/**
 * The current Monolith theme (<html data-theme>), kept in sync with the header toggle through
 * the `dappdrop:themechange` event. Renders 'obsidian' on the server and on the first client
 * render (the default for everyone), then syncs after mount, so it never causes a hydration
 * mismatch. CSS already follows data-theme before paint; use this only for JS that needs the
 * theme (the RainbowKit theme object).
 */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>('obsidian')
  useEffect(() => {
    const sync = () => setTheme(read())
    sync()
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])
  return theme
}
