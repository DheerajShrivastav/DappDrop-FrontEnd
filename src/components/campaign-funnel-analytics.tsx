'use client'

import { useEffect, useState } from 'react'
import { Loader2, TrendingUp, Download, Users, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Campaign } from '@/lib/types'

type FunnelAnalytics = {
  funnel: { joined: number; tasksStarted: number; qualified: number; claimed: number }
  taskStats: {
    taskIndex: number
    taskType: string
    completedCount: number
    participantCount: number
    completionRate: number
    failures: { reason: string; count: number }[]
  }[]
  humanityGated: boolean
  humanityExcluded: number
  claimSplit: { sponsored: number; self: number }
  claimsOverTime: { date: string; count: number }[]
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {value} <span className="text-xs text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-foreground rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/**
 * Host-only funnel/completion/claim analytics (P3 CP3) — genuinely new functionality, kept
 * separate from CampaignAnalytics (the existing raw per-participant table), which it doesn't
 * duplicate: this shows aggregate rates and trends, that shows individual rows.
 */
export function CampaignFunnelAnalytics({ campaign }: { campaign: Campaign }) {
  const [data, setData] = useState<FunnelAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    fetch(`/api/campaigns/${campaign.id}/analytics`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Failed to load analytics')
        }
        return res.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [campaign.id])

  if (campaign.status !== 'Ended' && campaign.status !== 'Closed') return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Funnel & Claim Analytics
          </CardTitle>
          <CardDescription>
            How participants moved from joining to claiming, and where they dropped off.
          </CardDescription>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/campaigns/${campaign.id}/analytics/export/funnel`} download>
              <Download className="h-3.5 w-3.5 mr-1" /> Funnel CSV
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/campaigns/${campaign.id}/analytics/export/allocation`} download>
              <Download className="h-3.5 w-3.5 mr-1" /> Allocation CSV
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : data ? (
          <>
            <div className="space-y-3">
              <FunnelBar label="Joined" value={data.funnel.joined} max={data.funnel.joined} />
              <FunnelBar label="Started a task" value={data.funnel.tasksStarted} max={data.funnel.joined} />
              <FunnelBar label="Qualified (all tasks)" value={data.funnel.qualified} max={data.funnel.joined} />
              <FunnelBar label="Claimed" value={data.funnel.claimed} max={data.funnel.joined} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Self-claimed</p>
                <p className="text-xl font-semibold">{data.claimSplit.self}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Sponsored</p>
                <p className="text-xl font-semibold">{data.claimSplit.sponsored}</p>
              </div>
              {data.humanityGated && (
                <div className="rounded-md border p-3 col-span-2 sm:col-span-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Excluded (not Humanity-verified)
                  </p>
                  <p className="text-xl font-semibold">{data.humanityExcluded}</p>
                </div>
              )}
            </div>

            {data.claimsOverTime.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Claims over time
                </p>
                <div className="flex items-end gap-1 h-20">
                  {data.claimsOverTime.map((b) => {
                    const max = Math.max(...data.claimsOverTime.map((x) => x.count))
                    const heightPct = max > 0 ? (b.count / max) * 100 : 0
                    return (
                      <div key={b.date} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${b.date}: ${b.count}`}>
                        <div className="w-full bg-foreground/80 rounded-t" style={{ height: `${Math.max(heightPct, 4)}%` }} />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{data.claimsOverTime[0]?.date}</span>
                  <span>{data.claimsOverTime[data.claimsOverTime.length - 1]?.date}</span>
                </div>
              </div>
            )}

            {data.taskStats.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Per-task completion
                </p>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead>Top failure reasons</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.taskStats.map((t) => (
                        <TableRow key={t.taskIndex}>
                          <TableCell>
                            [{t.taskIndex}] {t.taskType}
                          </TableCell>
                          <TableCell className="text-right">
                            {t.completedCount}/{t.participantCount}
                          </TableCell>
                          <TableCell className="text-right">{Math.round(t.completionRate * 100)}%</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.failures.length === 0
                              ? '—'
                              : t.failures
                                  .sort((a, b) => b.count - a.count)
                                  .slice(0, 3)
                                  .map((f) => `${f.reason} (${f.count})`)
                                  .join(', ')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
