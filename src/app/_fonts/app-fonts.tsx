import { Inter, Space_Grotesk } from 'next/font/google'

// The app's typefaces. They used to load from the root layout, which made every route,
// including the landing page, download Inter and Space Grotesk. They now load only where
// they're rendered: the (app) layout and the older marketing pages (about, changelog).
const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter',
})

const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-space-grotesk',
})

/**
 * Defines --font-inter / --font-space-grotesk on :root (not on a wrapper element), so content
 * that Radix portals into <body> (dialogs, popovers, toasts) still gets the app's fonts.
 * The tailwind `font-body` / `font-headline` stacks fall back to the system stack when these
 * variables are absent (the landing page).
 */
export function AppFonts() {
    const css = `:root{--font-inter:${inter.style.fontFamily};--font-space-grotesk:${spaceGrotesk.style.fontFamily}}`
    return <style dangerouslySetInnerHTML={{ __html: css }} />
}
