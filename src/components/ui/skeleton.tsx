import { cn } from "@/lib/utils"

/**
 * Loading placeholder. Uses Tailwind's built-in animate-pulse (a gentle opacity
 * breathe, not a decorative bounce) — this is the ONE animation kept for loading
 * states, matching Stripe/Linear-style skeleton screens instead of bare spinners.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
