import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

export default {
    // Strictly light-mode, deliberately: no .dark token block exists (see globals.css),
    // so dark mode is not configured at all rather than left half-wired. If dark mode is
    // ever wanted, add a real `.dark { ... }` block first, then re-enable `['class']` here.
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
        // status-styles.ts holds the status chip/banner classes; without this path Tailwind
        // never generated them, so every status chip rendered as white text on transparent.
        './src/lib/**/*.{ts,tsx}',
    ],
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                '2xl': '1400px',
            },
        },
        extend: {
            fontFamily: {
                // Each var() carries its own fallback: the app fonts load only on app routes and
                // the older marketing pages (src/app/_fonts/app-fonts.tsx). Without a fallback an
                // undefined variable would invalidate the whole font-family declaration.
                body: ['var(--font-inter, ui-sans-serif)', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
                headline: ['var(--font-space-grotesk, var(--font-inter, ui-sans-serif))', 'system-ui', 'sans-serif'],
                code: ['monospace'],
                // S1-01, landing only. Each var() has a fallback (see body/headline above).
                display: ['var(--font-display, Georgia)', 'Georgia', '"Times New Roman"', 'serif'],
                mono: ['var(--font-mono, ui-monospace)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
            },
            // S1-01: the landing type scale (plan §3.1 / VIS §4). New keys only; the app's text-*
            // sizes are untouched.
            fontSize: {
                'display-xl': ['clamp(2.25rem, 1.4rem + 4.2vw, 5.25rem)', { lineHeight: '1.04', letterSpacing: '-0.02em' }],
                'display-l': ['clamp(2rem, 1.35rem + 2.6vw, 3.5rem)', { lineHeight: '1.06', letterSpacing: '-0.018em' }],
                title: ['clamp(1.25rem, 1.1rem + 0.6vw, 1.625rem)', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
                lead: ['clamp(1.125rem, 1.05rem + 0.35vw, 1.3125rem)', { lineHeight: '1.5', letterSpacing: '-0.005em' }],
                body: ['1rem', { lineHeight: '1.6' }],
                small: ['0.875rem', { lineHeight: '1.5' }],
                'figure-l': ['clamp(1.5rem, 1.2rem + 1.2vw, 2.25rem)', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
                figure: ['0.9375rem', { lineHeight: '1.4' }],
                eyebrow: ['0.75rem', { lineHeight: '1.3', letterSpacing: '0.08em' }],
            },
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                // S1-01 landing tokens (src/app/globals.css). `signal` is the plan's `accent`.
                paper: { DEFAULT: 'var(--paper)', 2: 'var(--paper-2)' },
                surface: 'var(--surface)',
                sunk: 'var(--sunk)',
                ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
                rule: { DEFAULT: 'var(--rule)', strong: 'var(--rule-strong)' },
                signal: { DEFAULT: 'var(--signal)', 'on-ink': 'var(--signal-on-ink)' },
                // 08-site phase 1 (app routes only; src/app/(app)/app.css): text on a gold fill, and
                // the ONE red (errors and failed transactions only) with its label colour.
                'on-signal': 'var(--on-signal)',
                danger: { DEFAULT: 'var(--danger)', on: 'var(--on-danger)' },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))',
                },
                // The one deliberate color exception: muted/desaturated lifecycle + money
                // states (src/lib/status-styles.ts is the single mapping from a lifecycle
                // state to one of these). Never used decoratively.
                status: {
                    open: {
                        bg: 'hsl(var(--status-open-bg))',
                        border: 'hsl(var(--status-open-border))',
                        fg: 'hsl(var(--status-open-fg))',
                        solid: 'hsl(var(--status-open-solid))',
                    },
                    claimable: {
                        bg: 'hsl(var(--status-claimable-bg))',
                        border: 'hsl(var(--status-claimable-border))',
                        fg: 'hsl(var(--status-claimable-fg))',
                        solid: 'hsl(var(--status-claimable-solid))',
                    },
                    pending: {
                        bg: 'hsl(var(--status-pending-bg))',
                        border: 'hsl(var(--status-pending-border))',
                        fg: 'hsl(var(--status-pending-fg))',
                        solid: 'hsl(var(--status-pending-solid))',
                    },
                    closed: {
                        bg: 'hsl(var(--status-closed-bg))',
                        border: 'hsl(var(--status-closed-border))',
                        fg: 'hsl(var(--status-closed-fg))',
                        solid: 'hsl(var(--status-closed-solid))',
                    },
                    cancelled: {
                        bg: 'hsl(var(--status-cancelled-bg))',
                        border: 'hsl(var(--status-cancelled-border))',
                        fg: 'hsl(var(--status-cancelled-fg))',
                        solid: 'hsl(var(--status-cancelled-solid))',
                    },
                },
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            boxShadow: {
                'soft': '0 1px 2px 0 rgb(0 0 0 / 0.04)',
                'card': '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 1px -1px rgb(0 0 0 / 0.03)',
                'card-hover': '0 8px 24px -8px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.05)',
                'elevated': '0 1px 2px rgb(0 0 0 / 0.04), 0 12px 32px -12px rgb(0 0 0 / 0.08)',
                // S1-01 landing elevations: e1 (frames), e2 (the hero statement slip only).
                e1: '0 1px 2px rgb(23 23 23 / .05), 0 4px 12px -6px rgb(23 23 23 / .08)',
                e2: '0 1px 1px rgb(23 23 23 / .04), 0 28px 56px -28px rgb(23 23 23 / .22)',
            },
            transitionTimingFunction: {
                'out-soft': 'var(--ease-out)',
                lock: 'var(--ease-lock)',
            },
            keyframes: {
                'accordion-down': {
                    from: {
                        height: '0',
                    },
                    to: {
                        height: 'var(--radix-accordion-content-height)',
                    },
                },
                'accordion-up': {
                    from: {
                        height: 'var(--radix-accordion-content-height)',
                    },
                    to: {
                        height: '0',
                    },
                },
                shimmer: {
                    '0%': {
                        transform: 'translateX(-100%)',
                    },
                    '100%': {
                        transform: 'translateX(100%)',
                    },
                },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                shimmer: 'shimmer 2s ease-in-out infinite',
            },
        },
    },
    plugins: [
        require('tailwindcss-animate'),
        // S1-01: hover styles only where hover exists (plan: hoverOnlyWhenSupported, scoped to the
        // landing so app hover behaviour on touch devices doesn't change). Use `can-hover:hover:…`.
        plugin(({ addVariant }) => {
            addVariant('can-hover', '@media (hover: hover) and (pointer: fine)')
        }),
    ],
} satisfies Config
