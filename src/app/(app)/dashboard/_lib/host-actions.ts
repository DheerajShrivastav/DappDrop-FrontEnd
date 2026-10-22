/**
 * /dashboard (app-design §2.6): what each campaign needs from its host next, the "Needs you"
 * rows, the date range, and the CSV. Pure (no React, no fetch), unit-tested. The state comes only
 * from the ONE status model (src/lib/campaign-status.ts).
 *
 * Every action leads to the campaign page, where the host panels already do the work (open,
 * record the end, propose → publish the list, close, reclaim). The dashboard only says what's next.
 */
import { format } from 'date-fns'
import type { Campaign } from '@/lib/types'
import { SETTLEMENT_FALLBACK_DELAY_MS, getCampaignStatus, shortDate, shortDateTime, type CampaignStatusInfo } from '@/lib/campaign-status'

export type NeedsYou = {
  /** One line: what's needed and by when, in words. */
  detail: string
  /** The one button's verb. */
  action: string
}

export type HostNext = {
  /** The "Next" column ("Publish the list", "Ends on schedule"). */
  next: string
  /** Set when the host has to act: the campaign appears under "Needs you". */
  needsYou?: NeedsYou
}

/** A draft with escrow in it: the host chip reads "Draft · funded". Unknown → plain "Draft". */
export function isFundedDraft(c: Campaign): boolean {
  if (c.status !== 'Draft') return false
  const net = c.settlement?.erc20EscrowedNet
  try {
    return net !== undefined && BigInt(net) > BigInt(0)
  } catch {
    return false
  }
}

export function hostNext(c: Campaign, s: CampaignStatusInfo = getCampaignStatus(c), now: Date = new Date()): HostNext {
  const t = now.getTime()
  switch (s.state) {
    case 'draft':
      return {
        next: 'Open it',
        needsYou: {
          detail: isFundedDraft(c)
            ? 'Funded and ready. Participants can’t see it until you open it.'
            : 'Participants can’t see it until you open it.',
          action: 'Review and open',
        },
      }
    case 'upcoming':
      return { next: `Opens ${shortDateTime(c.startDate)}` }
    case 'open':
      return { next: 'Ends on schedule' }
    case 'ended_unrecorded':
      return {
        next: 'Record the end',
        needsYou: {
          detail: `It ended ${shortDate(c.endDate)}. Record the end on-chain (anyone can), then publish the reward list.`,
          action: 'Record the end',
        },
      }
    case 'ended_finalizing': {
      const due = new Date(c.endDate.getTime() + SETTLEMENT_FALLBACK_DELAY_MS)
      return {
        next: 'Publish the list',
        needsYou: {
          detail: `Publish the reward list by ${shortDate(due)}. After that, DappDrop can publish one for you.`,
          action: 'Propose the list',
        },
      }
    }
    case 'overdue_fallback':
      return {
        next: 'Publish the list (overdue)',
        needsYou: {
          detail: 'The reward list is more than 14 days late, so DappDrop can publish it now. You still can too.',
          action: 'Propose the list',
        },
      }
    case 'allocations_published':
      return { next: s.claimsOpenAt ? `Claims open ${shortDateTime(s.claimsOpenAt)}` : 'List in review (24 h)' }
    case 'claims_open':
      // TODO(redeploy): after contract PRs #23–#26, close is refused until a list is published
      // (SettlementNotPublished). Claims-open campaigns already have one, so nothing changes here.
      return { next: 'Close when ready' }
    case 'closed_claimable':
    case 'closed_no_claimants': {
      const at = s.sweepEligibleAt
      if (at && t >= at.getTime()) {
        return {
          next: 'Take back what’s left',
          needsYou: {
            detail:
              s.state === 'closed_no_claimants'
                ? 'Nobody qualified, and the 30 days are over. You can take the reward back.'
                : 'The 30-day claim period is over. You can take back what wasn’t claimed.',
            action: 'Reclaim',
          },
        }
      }
      return { next: at ? `Reclaim from ${shortDate(at)}` : 'Claims run 30 days' }
    }
    case 'swept':
    case 'cancelled':
      return { next: 'Nothing left to do' }
  }
}

/** "1–15 Oct", "28 Sep – 3 Oct", "30 Dec 2026 – 4 Jan 2027". */
export function dateRange(start: Date, end: Date): string {
  if (start.getFullYear() !== end.getFullYear()) return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`
  if (start.getMonth() !== end.getMonth()) return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`
  if (start.getDate() === end.getDate()) return format(end, 'd MMM')
  return `${format(start, 'd')}–${format(end, 'd MMM')}`
}

export type HostRow = {
  campaign: Campaign
  status: CampaignStatusInfo
  next: HostNext
  fundedDraft: boolean
}

/** Rows for the table, newest end first; "Needs you" keeps the same order. */
export function hostRows(campaigns: readonly Campaign[], now: Date = new Date()): HostRow[] {
  return [...campaigns]
    .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())
    .map((campaign) => {
      const status = getCampaignStatus(campaign, now)
      return { campaign, status, next: hostNext(campaign, status, now), fundedDraft: isFundedDraft(campaign) }
    })
}

/** The stat row's figures. "Open now" is time-aware (an ended-but-unrecorded campaign isn't open). */
export function hostStats(rows: readonly HostRow[]) {
  return {
    campaigns: rows.length,
    openNow: rows.filter((r) => r.status.state === 'open').length,
    participants: rows.reduce((n, r) => n + r.campaign.participants, 0),
  }
}

function csvCell(v: string | number): string {
  const s = String(v)
  // Quote everything that could break a row, and neutralise spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** "All campaigns" as CSV (Download (CSV)): the table's columns plus the exact dates. */
export function hostCsv(rows: readonly HostRow[]): string {
  const head = ['Campaign ID', 'Campaign', 'Status', 'Participants', 'Starts', 'Ends', 'Next']
  const body = rows.map((r) => [
    r.campaign.id,
    r.campaign.title,
    r.fundedDraft ? 'Draft · funded' : r.status.label,
    r.campaign.participants,
    r.campaign.startDate.toISOString(),
    r.campaign.endDate.toISOString(),
    r.next.next,
  ])
  return [head, ...body].map((cols) => cols.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
