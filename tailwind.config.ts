import type { Config } from 'tailwindcss'

export default {
    // Strictly light-mode, deliberately: no .dark token block exists (see globals.css),
    // so dark mode is not configured at all rather than left half-wired. If dark mode is
    // ever wanted, add a real `.dark { ... }` block first, then re-enable `['class']` here.
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
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
                body: ['var(--font-inter)', 'sans-serif'],
                headline: ['var(--font-space-grotesk)', 'var(--font-inter)', 'sans-serif'],
                code: ['monospace'],
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
    plugins: [require('tailwindcss-animate')],
} satisfies Config
