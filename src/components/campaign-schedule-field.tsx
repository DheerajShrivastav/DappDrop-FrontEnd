'use client'

import { useEffect, useState } from 'react'
import { addDays, startOfDay } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
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
        <Label>Starts</Label>
        <RadioGroup
          value={value.startMode}
          onValueChange={(v) => set({ startMode: v as ScheduleState['startMode'] })}
          className="gap-3"
        >
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-foreground/40">
            <RadioGroupItem value="now" id="start-now" className="mt-0.5" />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">As soon as it&apos;s created</span>
              <span className="block text-sm text-muted-foreground">
                Starts about 5 minutes after you create it
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-foreground/40">
            <RadioGroupItem value="scheduled" id="start-scheduled" className="mt-0.5" />
            <span className="block text-sm font-medium">Schedule for later</span>
          </label>
        </RadioGroup>

        {value.startMode === 'scheduled' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Popover open={startOpen} onOpenChange={setStartOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-w-0 flex-1 justify-start font-normal"
                    aria-label="Start date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{formatLocal(value.scheduledStart).split(',')[0]}</span>
                  </Button>
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
                <SelectTrigger className="h-10 w-[6.5rem] shrink-0" aria-label="Start time">
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
              <p className="text-sm text-muted-foreground">
                That time is less than 5 minutes away, so the campaign will start about 5 minutes
                after you create it instead.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Duration</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Duration">
          {DURATION_PRESET_DAYS.map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={value.preset === d ? 'default' : 'outline'}
              aria-pressed={value.preset === d}
              onClick={() => set({ preset: d })}
            >
              {d} {d === 1 ? 'day' : 'days'}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={value.preset === 'custom' ? 'default' : 'outline'}
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
          </Button>
        </div>

        {value.preset === 'custom' && (
          <div className="flex gap-2">
            <Popover open={endOpen} onOpenChange={setEndOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-w-0 flex-1 justify-start font-normal"
                  aria-label="End date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{formatLocal(value.customEnd).split(',')[0]}</span>
                </Button>
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
              <SelectTrigger className="h-10 w-[6.5rem] shrink-0" aria-label="End time">
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

      <div className={cn('min-h-[3.75rem] rounded-md border bg-muted/40 p-3 text-sm')} aria-live="polite">
        {mounted && (
          <>
            <p className="font-medium">{summary.primary}</p>
            <p className="mt-0.5 text-muted-foreground">{summary.utc}</p>
          </>
        )}
      </div>
    </div>
  )
}
