import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** Marks a task that's confirmed by the participant, not checked by the platform. Real checks
 * (Discord, Telegram, Humanity, holds, payment, wallet connect via SIWE) never get this. */
export function SelfReportedBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('h-5 shrink-0 px-1.5 py-0 text-[10px] font-medium text-muted-foreground', className)}
      title="The participant confirmed this themselves — it isn't checked automatically yet."
    >
      Self-reported
    </Badge>
  )
}
