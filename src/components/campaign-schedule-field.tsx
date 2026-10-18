'use client'

import { useEffect, useState } from 'react'
import { addDays, startOfDay } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { START_BUFFER_SEC } from '@/lib/campaign-timing'
import {
  DURATION_PRESET_DAYS,
  TIME_OPTIONS,
  effectiveStart,
  formatLocal,
  roundUpToQuarterHour,
  scheduleSummary,
  scheduledStartWillMove,
  toTimeOption,
  withDay,
  withTime,
  type ScheduleState,
} from '@/lib/campaign-schedule'

const DAY_MS = 24 * 60 * 60 * 1000

// 08-site phase 1: the Monolith re-skin (app-design §1.10). Behaviour unchanged: segmented
// "Starts" and duration presets, 48 px date/time controls on --sunk, the shadcn Calendar with
// 44 px day cells, and the live summary after mount.
const LABEL = 'text-[0.9375rem] font-semibold text-ink'
const SEGMENTS = 'inline-flex max-w-full flex-wrap gap-[2px] rounded-[1.5rem] border border-rule-strong p-[3px]'
const SEGMENT =
  'inline-flex h-[2.375rem] cursor-pointer items-center whitespace-nowrap rounded-full px-4 text-small text-ink-2 transition-colors [transition-duration:var(--dur-micro)] can-hover:hover:text-ink'
const SEGMENT_ON = 'bg-ink text-paper can-hover:hover:text-paper'
const CONTROL =
  'flex h-12 items-center rounded-md border border-rule-strong bg-sunk px-[0.9rem] text-[0.9375rem] text-ink transition-colors [transition-duration:var(--dur-micro)] can-hover:hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal'

/**
 * Schedule input for the create wizard. Owns no form state — the page holds ScheduleState and
 * derives `dates` from it (scheduleToDates), so the Review step and submit read the same value.
 * Validation messages come from the `dates` FormMessage the page renders under this.
 */
export function CampaignScheduleField({
  value,
  onChange,
}: {
  value: ScheduleState
  onChange: (next: ScheduleState) => void
}) {
  // Ticks so "about 5 minutes", disabled past times and the summary stay current while the
  // host sits on this step.
  const [now, setNow] = useState(() => new Date())
  // The summary depends on the VIEWER's clock, zone and locale, none of which the server
  // shares — rendering it during SSR is a guaranteed hydration mismatch. Show it after mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const [startOpen, setStartOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)

  const today = startOfDay(now)
  const lastStartDay = addDays(today, 365)
  const effStart = effectiveStart(value, now)
  const summary = scheduleSummary(value, now)
  const startWillMove = scheduledStartWillMove(value, now)

  // On today's date, times before now + buffer would be moved anyway — don't offer them.
  const earliestStartMs = now.getTime() + START_BUFFER_SEC * 1000
  const startIsToday = startOfDay(value.scheduledStart).getTime() === today.getTime()
  const isPastSlot = (hhmm: string) =>
    startIsToday && withTime(value.scheduledStart, hhmm).getTime() < earliestStartMs

  const set = (patch: Partial<ScheduleState>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p id="schedule-starts" className={LABEL}>Starts</p>
        <RadioGroup
          value={value.startMode}
          onValueChange={(v) => set({ startMode: v as ScheduleState['startMode'] })}
          aria-labelledby="schedule-starts"
          className={cn(SEGMENTS, 'grid-cols-none')}
        >
          {(
            [
              ['now', 'start-now', <>As soon as it&apos;s created</>],
              ['scheduled', 'start-scheduled', 'Schedule for later'],
            ] as const
          ).map(([mode, id, text]) => (
            <label
              key={mode}
              htmlFor={id}
              className={cn(
                SEGMENT,
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-signal',
                value.startMode === mode && SEGMENT_ON,
              )}
            >
              <RadioGroupItem value={mode} id={id} className="sr-only" />
              {text}
            </label>
          ))}
        </RadioGroup>
        {value.startMode === 'now' && (
          <p className="text-[0.8125rem] text-ink-2">Starts about 5 minutes after you create it.</p>
        )}

        {value.startMode === 'scheduled' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Popover open={startOpen} onOpenChange={setStartOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className={cn(CONTROL, 'min-w-0 flex-1 justify-start gap-2 text-left')} aria-label="Start date">
                    <CalendarIcon className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                    <span className="truncate">{formatLocal(value.scheduledStart).split(',')[0]}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    numberOfMonths={1}
                    selected={value.scheduledStart}
                    defaultMonth={value.scheduledStart}
                    disabled={[{ before: today }, { after: lastStartDay }]}
                    onSelect={(day) => {
                      if (!day) return
                      set({ scheduledStart: withDay(value.scheduledStart, day) })
                      setStartOpen(false)
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Select
                value={toTimeOption(value.scheduledStart)}
                onValueChange={(v) => set({ scheduledStart: withTime(value.scheduledStart, v) })}
              >
                <SelectTrigger className={cn(CONTROL, 'w-[6.75rem] shrink-0 justify-between font-mono text-[0.875rem]')} aria-label="Start time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t} disabled={isPastSlot(t)}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {startWillMove && (
              <p className="text-[0.8125rem] text-ink-2">
                That time is less than 5 minutes away, so the campaign will start about 5 minutes
                after you create it instead.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p id="schedule-duration" className={LABEL}>Duration</p>
        <div className={SEGMENTS} role="group" aria-labelledby="schedule-duration">
          {DURATION_PRESET_DAYS.map((d) => (
            <button
              key={d}
              type="button"
              className={cn(SEGMENT, value.preset === d && SEGMENT_ON)}
              aria-pressed={value.preset === d}
              onClick={() => set({ preset: d })}
            >
              {d} {d === 1 ? 'day' : 'days'}
            </button>
          ))}
          <button
            type="button"
            className={cn(SEGMENT, value.preset === 'custom' && SEGMENT_ON)}
            aria-pressed={value.preset === 'custom'}
            onClick={() =>
              // Seed the custom end from what the host was just looking at, so switching to
              // Custom doesn't jump the end somewhere else.
              set({
                preset: 'custom',
                customEnd:
                  value.preset === 'custom'
                    ? value.customEnd
                    : roundUpToQuarterHour(
                        new Date(effStart.getTime() + (value.preset as number) * DAY_MS),
                      ),
              })
            }
          >
            Custom
          </button>
        </div>

        {value.preset === 'custom' && (
          <div className="flex gap-2">
            <Popover open={endOpen} onOpenChange={setEndOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={cn(CONTROL, 'min-w-0 flex-1 justify-start gap-2 text-left')} aria-label="End date">
                  <CalendarIcon className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                  <span className="truncate">{formatLocal(value.customEnd).split(',')[0]}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  numberOfMonths={1}
                  selected={value.customEnd}
                  defaultMonth={value.customEnd}
                  disabled={[
                    { before: startOfDay(effStart) },
                    { after: new Date(effStart.getTime() + 365 * DAY_MS) },
                  ]}
                  onSelect={(day) => {
                    if (!day) return
                    set({ customEnd: withDay(value.customEnd, day) })
                    setEndOpen(false)
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Select
              value={toTimeOption(value.customEnd)}
              onValueChange={(v) => set({ customEnd: withTime(value.customEnd, v) })}
            >
              <SelectTrigger className={cn(CONTROL, 'w-[6.75rem] shrink-0 justify-between font-mono text-[0.875rem]')} aria-label="End time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="min-h-[3.75rem] rounded-md border border-rule bg-sunk px-4 py-3 text-small" aria-live="polite">
        {mounted && (
          <>
            <p className="font-medium text-ink">{summary.primary}</p>
            <p className="mt-0.5 font-mono text-[0.8125rem] text-ink-2">{summary.utc}</p>
          </>
        )}
      </div>
    </div>
  )
}
