import { darkTheme, lightTheme, type Theme as RainbowTheme } from '@rainbow-me/rainbowkit'
import type { Theme } from '@/components/landing/theme'

/**
 * The RainbowKit modal in Monolith (app-design §1.4): built from RainbowKit's own dark / light
 * themes (for their translucent overlays), with every surface, text and border colour pointing at
 * the app's CSS tokens. RainbowKit writes these into CSS custom properties on [data-rk], so
 * `var(--surface)` resolves against <html data-theme> like the rest of the app. Gold accent (the
 * action colour) with the --on-signal label, a 10 px radius, the system font stack, no blur.
 *
 * The connect / account pills in the header are our own (ConnectButton.Custom); this styles only
 * the modals RainbowKit opens (connect, account, chain switch).
 */
export function rainbowTheme(theme: Theme): RainbowTheme {
  const base = (theme === 'porcelain' ? lightTheme : darkTheme)({
    accentColor: 'var(--signal)',
    accentColorForeground: 'var(--on-signal)',
    borderRadius: 'medium',
    fontStack: 'system',
    overlayBlur: 'none',
  })
  return {
    ...base,
    colors: {
      ...base.colors,
      modalBackground: 'var(--surface)',
      modalBorder: 'var(--rule)',
      modalText: 'var(--ink)',
      modalTextSecondary: 'var(--ink-2)',
      modalTextDim: 'var(--ink-3)',
      generalBorder: 'var(--rule)',
      generalBorderDim: 'var(--rule)',
      closeButton: 'var(--ink-2)',
      closeButtonBackground: 'var(--sunk)',
      actionButtonSecondaryBackground: 'var(--sunk)',
      actionButtonBorder: 'var(--rule-strong)',
      actionButtonBorderMobile: 'var(--rule-strong)',
      profileForeground: 'var(--sunk)',
      profileAction: 'var(--surface)',
      profileActionHover: 'var(--rule)',
      menuItemBackground: 'var(--rule)',
      selectedOptionBorder: 'var(--rule-strong)',
      connectButtonBackground: 'var(--paper)',
      connectButtonInnerBackground: 'var(--surface)',
      connectButtonText: 'var(--ink)',
      connectButtonBackgroundError: 'var(--danger)',
      connectButtonTextError: 'var(--on-danger)',
      error: 'var(--danger)',
      modalBackdrop: theme === 'porcelain' ? 'rgba(27, 25, 22, 0.45)' : 'rgba(0, 0, 0, 0.6)',
      downloadBottomCardBackground: 'var(--surface)',
      downloadTopCardBackground: 'var(--sunk)',
    },
    radii: {
      ...base.radii,
      actionButton: '999px',
      connectButton: '999px',
      menuButton: '10px',
      modal: '10px',
      modalMobile: '10px',
    },
    shadows: {
      ...base.shadows,
      dialog: '0 16px 40px -16px rgb(0 0 0 / 0.5)',
      connectButton: 'none',
    },
  }
}
