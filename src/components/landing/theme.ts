/**
 * 07-wow: the Monolith themes (build contract §Theme). Server-safe constants only.
 *
 * - Obsidian (dark + gold) is the default for everyone, regardless of prefers-color-scheme.
 * - Porcelain (light) is opt-in through the header toggle, remembered per browser in
 *   localStorage['dd-theme'] (wrapped in try/catch: private windows and blocked storage fall
 *   back to Obsidian and the page still works).
 * - The 3D scene reads document.documentElement.dataset.theme at mount and listens for
 *   THEME_EVENT ({ detail: { theme } }) on window.
 */
export const THEMES = ['obsidian', 'porcelain'] as const
export type Theme = (typeof THEMES)[number]
export const DEFAULT_THEME: Theme = 'obsidian'
export const THEME_STORAGE_KEY = 'dd-theme'
export const THEME_EVENT = 'dappdrop:themechange'
/** Browser chrome colour (meta theme-color) per theme. */
export const THEME_COLOR: Record<Theme, string> = { obsidian: '#050506', porcelain: '#F4F1EA' }

/**
 * Inline in <head> (root layout), before any stylesheet paints: sets <html data-theme>. No
 * media query on purpose: the OS preference never picks the theme. ~200 bytes.
 */
export const THEME_SCRIPT = `(function(){var t='${DEFAULT_THEME}';try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(s==='porcelain'||s==='obsidian')t=s}catch(e){}document.documentElement.setAttribute('data-theme',t)})()`
