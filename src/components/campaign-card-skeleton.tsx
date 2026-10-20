// Direct module imports, not the '@/components/app' barrel: the barrel pulls every primitive
// (ScheduleField's calendar, ClaimActions…) into the route's first load.
import { CardSkeleton, LoadingRegion } from '@/components/app/states'

/** The /campaigns grid (3 columns, 2 from 700 px, 1 below). Shared by the cards and their skeletons. */
export const CAMPAIGN_GRID = 'grid gap-5 min-[700px]:grid-cols-2 lg:grid-cols-3'

/** Loading: the card's exact shape (CardSkeleton), so nothing jumps when the data lands. */
export function CampaignGridSkeleton({ count = 6, label = 'Loading campaigns' }: { count?: number; label?: string }) {
  return (
    <LoadingRegion label={label} className={CAMPAIGN_GRID}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </LoadingRegion>
  )
}
