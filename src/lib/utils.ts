import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge must know the theme's custom names (tailwind.config.ts), or it treats e.g.
// `text-on-signal` (a colour) and `text-body` (a size) as the same group and drops one: the gold
// reward button lost its label colour that way.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ["paper", "paper-2", "surface", "sunk", "ink", "ink-2", "ink-3", "rule", "rule-strong", "signal", "signal-on-ink", "on-signal", "danger", "danger-on"],
      text: ["display-xl", "display-l", "title", "lead", "body", "small", "figure-l", "figure", "eyebrow"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateAddress(addr: string | null) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
