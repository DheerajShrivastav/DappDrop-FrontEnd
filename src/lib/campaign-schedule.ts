/**
 * The wizard's Schedule input model. The host picks a start MODE and a duration; this turns
 * that into the `dates: { from, to }` form value that campaignDatesSchema validates and submit
 * sends. startTime/endTime are fixed at createCampaign and can't be changed afterwards, so the
 * input is built so it can't produce a surprising timestamp: times come from a fixed
 * 15-minute list (no free-typed hour/minute that JS Date rolls into another day), and picking a
 * day keeps the chosen time.
 *
 * Pure (no React) — shared by the field component, the Review step and submit.
 */

import { START_BUFFER_SEC } from './campaign-timing'

export const DURATION_PRESET_DAYS = [1, 3, 7, 14, 30] as const
export type DurationPreset = (typeof DURATION_PRESET_DAYS)[number] | 'custom'

export type ScheduleState = {
  /** 'now' = start as soon as the campaign is created (resolveCampaignTiming moves it to
   * chain time + START_BUFFER_SEC). Re-evaluated at submit, never frozen at page load. */
  startMode: 'now' | 'scheduled'
  /** Used only when startMode === 'scheduled'. */
  scheduledStart: Date
  preset: DurationPreset
  /** Used only when preset === 'custom'. Kept as-is if the start later moves — the schema
   * then reports too-short/too-long instead of the end being silently shifted. */
  customEnd: Date
}

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const BUFFER_MS = START_BUFFER_SEC * 1000

/** Round up to the next 15-minute boundary (seconds/ms zeroed). */
export function roundUpToQuarterHour(d: Date): Date {
  const r = new Date(d)
  r.setSeconds(0, 0)
  const m = r.getMinutes()
  const up = Math.ceil(m / 15) * 15
  r.setMinutes(up) // 60 rolls to the next hour correctly — a bounded, intended rollover
  if (r.getTime() < d.getTime()) r.setMinutes(r.getMinutes() + 15)
  return r
}

export function defaultScheduleState(now: Date = new Date()): ScheduleState {
  const scheduledStart = roundUpToQuarterHour(new Date(now.getTime() + 60 * MINUTE_MS))
  return {
    startMode: 'now',
    scheduledStart,
    preset: 7,
    customEnd: roundUpToQuarterHour(new Date(now.getTime() + BUFFER_MS + 7 * DAY_MS)),
  }
}

/** The start the contract will actually see, per resolveCampaignTiming: never earlier than
 * now + START_BUFFER_SEC. */
export function effectiveStart(s: ScheduleState, now: Date): Date {
  const earliest = now.getTime() + BUFFER_MS
  const picked = s.startMode === 'now' ? now.getTime() : s.scheduledStart.getTime()
  return new Date(Math.max(picked, earliest))
}

/**
 * ScheduleState -> the form's `dates` value. `from` is the host's intent ("now" or the picked
 * time) — campaignDatesSchema/resolveCampaignTiming apply the buffer themselves, so the
 * too-short message can explain a moved start. A preset end is measured from the EFFECTIVE
 * start, so "7 days" means 7 days of actual running time.
 */
export function scheduleToDates(s: ScheduleState, now: Date): { from: Date; to: Date } {
  const from = s.startMode === 'now' ? new Date(now) : new Date(s.scheduledStart)
  const to =
    s.preset === 'custom'
      ? new Date(s.customEnd)
      : new Date(effectiveStart(s, now).getTime() + s.preset * DAY_MS)
  return { from, to }
}

/** True when a SCHEDULED start is too close to (or before) now and will be moved. */
export function scheduledStartWillMove(s: ScheduleState, now: Date): boolean {
  return s.startMode === 'scheduled' && s.scheduledStart.getTime() < now.getTime() + BUFFER_MS
}

/** Replace the calendar day of `base`, keeping its hour and minute. react-day-picker hands back
 * midnight; taking that as-is is how a day click used to wipe the chosen time. */
export function withDay(base: Date, day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), base.getHours(), base.getMinutes())
}

/** Replace the time of `base` with an "HH:mm" option value. Only ever called with values from
 * TIME_OPTIONS, so hours/minutes are always in range and can't roll into another day. */
export function withTime(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m)
}

/** "00:00" … "23:45". */
export const TIME_OPTIONS: string[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

export function toTimeOption(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// --- Display -------------------------------------------------------------------------------

/** "UTC+5:30" for the local zone at `d` (per-date, so DST is handled). */
export function utcOffsetLabel(d: Date): string {
  const offsetMin = -d.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`
}

/** "IST (UTC+5:30)", or just "UTC+5:30" when the runtime only has a GMT-style name. Never
 * hardcoded — comes from Intl for the viewer's own zone. */
export function zoneLabel(d: Date): string {
  const offset = utcOffsetLabel(d)
  let name: string | undefined
  try {
    name = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName')?.value
  } catch {
    name = undefined
  }
  if (!name || /^(GMT|UTC)/.test(name)) return offset
  return `${name} (${offset})`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad2 = (n: number) => String(n).padStart(2, '0')

// Built by hand rather than with Intl month/weekday names: ICU versions disagree ("Sep" vs
// "Sept"), and this line must read the same in the field, the Review step and any screenshot.
function parts(d: Date, utc: boolean): string {
  const [wd, day, mon, h, m] = utc
    ? [d.getUTCDay(), d.getUTCDate(), d.getUTCMonth(), d.getUTCHours(), d.getUTCMinutes()]
    : [d.getDay(), d.getDate(), d.getMonth(), d.getHours(), d.getMinutes()]
  return `${WEEKDAYS[wd]} ${day} ${MONTHS[mon]}, ${pad2(h)}:${pad2(m)}`
}

/** "Tue 29 Sep, 14:45" in the viewer's local zone. */
export function formatLocal(d: Date): string {
  return parts(d, false)
}

/** "Tue 29 Sep, 09:15" in UTC. */
export function formatUtc(d: Date): string {
  return parts(d, true)
}

/** "7 days", "1 day 3 hours", "55 minutes". */
export function formatDurationMs(ms: number): string {
  if (ms <= 0) return '0 minutes'
  const totalMin = Math.round(ms / MINUTE_MS)
  const days = Math.floor(totalMin / (24 * 60))
  const hours = Math.floor((totalMin % (24 * 60)) / 60)
  const mins = totalMin % 60
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  const out: string[] = []
  if (days) out.push(plural(days, 'day'))
  if (hours) out.push(plural(hours, 'hour'))
  if (mins && !days) out.push(plural(mins, 'minute'))
  return out.join(' ') || plural(mins, 'minute')
}

export type ScheduleSummary = {
  /** Main line, e.g. "Runs Tue 29 Sep, 14:45 → Tue 6 Oct, 14:45 IST (UTC+5:30) · 7 days". */
  primary: string
  /** Muted line with the same instants in UTC. */
  utc: string
}

/** One summary for both the field and the Review step so they can't disagree. */
export function scheduleSummary(s: ScheduleState, now: Date): ScheduleSummary {
  const { to } = scheduleToDates(s, now)
  const start = effectiveStart(s, now)
  const duration = formatDurationMs(to.getTime() - start.getTime())
  const startZone = zoneLabel(start)
  const endZone = zoneLabel(to)
  // Show the zone once unless start and end fall on different offsets (a DST change).
  const zoneSuffix = startZone === endZone ? ` ${endZone}` : ''
  const startZoneInline = startZone === endZone ? '' : ` ${startZone}`
  const endZoneInline = startZone === endZone ? '' : ` ${endZone}`

  if (s.startMode === 'now') {
    // The exact start depends on when the host clicks Create, so the end is "around".
    const endPrefix = s.preset === 'custom' ? 'ends' : 'ends around'
    return {
      primary: `Starts about 5 minutes after you create it · ${endPrefix} ${formatLocal(to)}${endZoneInline}${zoneSuffix} · ${duration}`,
      utc: `${endPrefix === 'ends' ? 'Ends' : 'Ends around'} ${formatUtc(to)} UTC`,
    }
  }
  return {
    primary: `Runs ${formatLocal(start)}${startZoneInline} → ${formatLocal(to)}${endZoneInline}${zoneSuffix} · ${duration}`,
    utc: `${formatUtc(start)} → ${formatUtc(to)} UTC`,
  }
}
