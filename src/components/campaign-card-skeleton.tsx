import { Card, CardContent, CardFooter, CardHeader } from './ui/card'
import { Skeleton } from './ui/skeleton'

/** Loading placeholder shaped like CampaignCard — used everywhere a campaign grid can be
 * loading, so the layout never jumps between skeleton and real content. */
export function CampaignCardSkeleton() {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="p-0">
        <Skeleton className="h-52 w-full rounded-none" />
      </CardHeader>
      <div className="p-6 flex flex-col flex-grow gap-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="mt-auto space-y-3 pt-3">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>
      <CardFooter className="border-t p-4">
        <Skeleton className="h-5 w-24" />
      </CardFooter>
    </Card>
  )
}

export function CampaignGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CampaignCardSkeleton key={i} />
      ))}
    </div>
  )
}
