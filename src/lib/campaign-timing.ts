/**
 * Campaign start/end rules, mirrored from CampaignStorage._validateCampaignParams:
 *
 *   startTime >  block.timestamp AT MINING  (else CampaignStartTimeNotYetStarted — misnamed,
 *                                            it fires when the start is already in the PAST)
 *   endTime   >  startTime
 *   MIN_CAMPAIGN_DURATION (1h) <= endTime - startTime <= MAX_CAMPAIGN_DURATION (365d)
 *                                           (else InvalidCampaignDuration)
 *
 * Pure (no ethers, no React) so the wizard's zod schema and its submit path share one
 * implementation. The only difference between the two callers is `chainNow`: the schema
 * approximates it with the local clock, the submit path passes the latest BLOCK timestamp,
 * which is what the contract actually compares against.
 */

import * as z from 'zod'

export const MIN_CAMPAIGN_DURATION_SEC = 60 * 60 // MIN_CAMPAIGN_DURATION
export const MAX_CAMPAIGN_DURATION_SEC = 365 * 24 * 60 * 60 // MAX_CAMPAIGN_DURATION

/**
 * How far past the latest block a start time must be before we submit. The start is checked
 * against the block the tx is MINED in, not the one we read — this covers wallet-confirmation
 * time, mempool wait and a few blocks of inclusion delay. A start closer than this gets moved.
 */
export const START_BUFFER_SEC = 5 * 60

export type CampaignTimingIssue = 'too_short' | 'too_long' | 'end_before_start'

export type CampaignTiming = {
  /** The start that will actually be submitted (seconds). */
  startTime: number
  endTime: number
  /** True when the picked start was too close to (or before) chainNow and was moved later. */
  startAdjusted: boolean
  issue: CampaignTimingIssue | null
}

export function resolveCampaignTiming(params: {
  pickedStart: number // unix seconds
  end: number // unix seconds
  chainNow: number // unix seconds
}): CampaignTiming {
  const earliestSafeStart = params.chainNow + START_BUFFER_SEC
  const startAdjusted = params.pickedStart < earliestSafeStart
  const startTime = startAdjusted ? earliestSafeStart : params.pickedStart
  const endTime = params.end
  const duration = endTime - startTime

  let issue: CampaignTimingIssue | null = null
  if (endTime <= startTime) issue = 'end_before_start'
  else if (duration < MIN_CAMPAIGN_DURATION_SEC) issue = 'too_short'
  else if (duration > MAX_CAMPAIGN_DURATION_SEC) issue = 'too_long'

  return { startTime, endTime, startAdjusted, issue }
}

/** Host-facing explanation for a timing issue. Mentions the moved start when that's the cause. */
export function campaignTimingMessage(t: CampaignTiming): string | null {
  if (!t.issue) return null
  if (t.issue === 'too_long') return 'Campaigns can run for at most 365 days.'
  if (t.startAdjusted) {
    // The host picked a start under 5 minutes away (or already past); it gets moved ~5 minutes out, and
    // that pushed the end too close. Only moving the end fixes it — the start can't go earlier.
    return 'Campaigns must run for at least 1 hour. Your start time is less than 5 minutes away (or already past), so it will begin about 5 minutes from now — move the end time later.'
  }
  if (t.issue === 'end_before_start') return 'End date must be after the start date.'
  return 'Campaigns must run for at least 1 hour.'
}

/** Shown before opening a Draft whose end time has already passed. openCampaign has no timing
 * check on-chain, and endCampaign is permissionless once endTime is reached, so the open
 * would succeed and the campaign could be ended by anyone (or the keeper) straight away. */
export const EXPIRED_OPEN_WARNING =
  "This campaign's end time has passed. Opening now gives participants no time to take part, and anyone can end it immediately."

export function hasEndTimePassed(endDate: Date, now: Date = new Date()): boolean {
  return now.getTime() >= endDate.getTime()
}

/**
 * The wizard's `dates` field. Mirrors the contract's duration rules against the EFFECTIVE start
 * — the one submit will actually send after moving a near/past start ~5 minutes out — so a
 * campaign that passes here can't then fail submit's re-check for a reason the host was never
 * shown. Uses the local clock as a stand-in for the block clock; submit re-runs
 * resolveCampaignTiming against the real block timestamp.
 */
export const campaignDatesSchema = z
  .object({
    from: z.date({ required_error: 'Start date is required.' }),
    to: z.date({ required_error: 'End date is required.' }),
  })
  .superRefine((data, ctx) => {
    const timing = resolveCampaignTiming({
      pickedStart: Math.floor(data.from.getTime() / 1000),
      end: Math.floor(data.to.getTime() / 1000),
      chainNow: Math.floor(Date.now() / 1000),
    })
    const message = campaignTimingMessage(timing)
    // No `path`: the issue must sit on `dates` itself. The wizard's <FormMessage> reads
    // error.message of the field it's under ("dates"), so an issue at dates.to rendered as
    // nothing — which is why the old path:['to'] "end after start" message never showed.
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message })
  })
