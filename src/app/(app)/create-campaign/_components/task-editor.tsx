'use client'

import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { Button, Field, Input, LockedField, VerificationChip, controlClass } from '@/components/app'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import config from '@/app/config'
import { DEPLOYMENT_CHAIN } from '@/lib/deployment-chain'
import { HUMANITY_PRESETS } from '@/lib/humanity-presets'
import { isSelfReportedTask, SELF_REPORTED_TASK_NOTE, TASK_VERIFICATION_METHOD } from '@/lib/task-types'
import type { TaskType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { TASK_TYPE_OPTIONS, fieldId, taskTypeLabel, type CampaignFormValues } from './campaign-form'
import { CheckRow, Notice, SetupChecklist } from './wizard-ui'

const num = (i: number) => String(i + 1).padStart(2, '0')

/**
 * A finished task, collapsed (mockup wizard.html): its number, what participants do, how it's
 * checked, and [Edit].
 */
export function TaskSummaryRow({ index, onEdit }: { index: number; onEdit: () => void }) {
  const task = useWatch<CampaignFormValues, `tasks.${number}`>({ name: `tasks.${index}` })
  const type = task?.type as TaskType
  return (
    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 border-t border-rule px-5 py-4 first:border-t-0 sm:grid-cols-[2rem_minmax(0,1fr)_auto]" data-task-row={index}>
      <span className="pt-0.5 font-mono text-[0.8125rem] text-ink-3">{num(index)}</span>
      <div className="grid min-w-0 flex-1 gap-1.5">
        <p className="font-medium text-ink [overflow-wrap:anywhere]">
          {task?.description}
          {task?.isOptional && <span className="ml-1.5 text-[0.8125rem] font-normal text-ink-3">(optional)</span>}
        </p>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] text-ink-2">{taskTypeLabel(type)}</span>
          {type && <VerificationChip method={TASK_VERIFICATION_METHOD[type]} withNote />}
        </span>
      </div>
      <Button size="sm" variant="secondary" className="col-start-2 justify-self-start sm:col-start-3" onClick={onEdit} aria-label={`Edit task ${index + 1}`}>
        Edit
      </Button>
    </div>
  )
}

/**
 * One task, expanded: type (with how it's checked), what participants do, the type's own
 * settings (Discord, Telegram, payment, Humanity), and the Optional flag. Same fields, defaults
 * and validation as before the restyle; only the layout changed.
 */
export function TaskEditor({
  index,
  canRemove,
  onRemove,
  onDone,
}: {
  index: number
  canRemove: boolean
  onRemove: () => void
  /** Collapse this task (only offered once it's complete). */
  onDone?: () => void
}) {
  const form = useFormContext<CampaignFormValues>()
  const { control } = form
  const task = useWatch({ control, name: `tasks.${index}` })
  const type = task?.type as TaskType
  const method = type ? TASK_VERIFICATION_METHOD[type] : undefined
  const selfReported = isSelfReportedTask(type)
  const checkLine = TASK_TYPE_OPTIONS.find((o) => o.value === type)?.checkLine

  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-5 rounded-[10px] border border-rule-strong bg-surface p-5 md:p-6" aria-label={`Task ${index + 1}`} data-task-editor={index}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="dd-eyebrow">Task {num(index)}</p>
        <div className="flex items-center gap-4">
          {onDone && (
            <button type="button" className="dd-link min-h-11 text-small text-ink" onClick={onDone} aria-label={`Done with task ${index + 1}`}>
              Done
            </button>
          )}
          {canRemove && (
            <button type="button" className="dd-link min-h-11 text-small text-ink" onClick={onRemove} aria-label={`Remove task ${index + 1}`}>
              Remove
            </button>
          )}
        </div>
      </div>

      <Controller
        control={control}
        name={`tasks.${index}.type`}
        render={({ field, fieldState }) => (
          <Field
            id={fieldId(`tasks.${index}.type`)}
            label="Type"
            error={fieldState.error?.message}
            help={
              method ? (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <VerificationChip method={method} />
                  <span>{selfReported ? SELF_REPORTED_TASK_NOTE : checkLine}</span>
                </span>
              ) : undefined
            }
          >
            {(p) => (
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v)
                  // Self-reported tasks default to optional (they can't keep bots out); verified
                  // ones default to required. The host can override.
                  form.setValue(`tasks.${index}.isOptional`, isSelfReportedTask(v))
                }}
              >
                <SelectTrigger id={p.id} aria-describedby={p['aria-describedby']} aria-invalid={p['aria-invalid']} className={controlClass('justify-between')}>
                  <SelectValue placeholder="Pick a task type">{taskTypeLabel(field.value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} textValue={opt.label} className="py-2.5">
                      <span className="flex flex-col items-start gap-1.5">
                        <span>{opt.label}</span>
                        <VerificationChip method={TASK_VERIFICATION_METHOD[opt.value]} />
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        )}
      />

      <Controller
        control={control}
        name={`tasks.${index}.description`}
        render={({ field, fieldState }) => (
          <Field id={fieldId(`tasks.${index}.description`)} label="What participants do" error={fieldState.error?.message}>
            {(p) => <Input {...p} placeholder="e.g. Follow @project on X" {...field} value={field.value ?? ''} />}
          </Field>
        )}
      />

      {type === 'JOIN_DISCORD' && (
        <>
          {!config.discordBotInviteUrl && (
            <Notice tone="error" title="Discord checks won’t work yet">
              The DappDrop Discord bot isn’t set up, so Discord join tasks can’t be verified. Contact support.
            </Notice>
          )}
          <Controller
            control={control}
            name={`tasks.${index}.verificationData`}
            render={({ field, fieldState }) => (
              <Field id={fieldId(`tasks.${index}.verificationData`)} label="Discord server ID" help="The ID of the server participants join. The bot checks membership against it." error={fieldState.error?.message}>
                {(p) => <Input {...p} placeholder="e.g. 1024849645714206720" className="font-mono text-[0.875rem]" {...field} value={field.value ?? ''} />}
              </Field>
            )}
          />
          <HowTo summary="How to find your Discord server ID">
            <p>1. In Discord, turn on Developer Mode: Settings → Advanced → Developer Mode.</p>
            <p>2. Right-click your server’s name.</p>
            <p>3. Click “Copy Server ID”.</p>
          </HowTo>
          <Controller
            control={control}
            name={`tasks.${index}.discordInviteLink`}
            render={({ field, fieldState }) => (
              <Field id={fieldId(`tasks.${index}.discordInviteLink`)} label="Discord invite link" help="The link participants use to join your server." error={fieldState.error?.message}>
                {(p) => <Input {...p} placeholder="e.g. https://discord.gg/yourcode or just yourcode" {...field} value={field.value ?? ''} />}
              </Field>
            )}
          />
          <SetupChecklist
            title="Required: add the DappDrop bot to your server"
            steps={[
              'Open the invite below and pick your server.',
              'Keep the “View Server Members” and “Read Message History” permissions ticked.',
              'Authorize. Join tasks are then checked automatically.',
            ]}
            action={config.discordBotInviteUrl ? { label: 'Add the DappDrop bot to your server', href: config.discordBotInviteUrl } : undefined}
            missingActionText="The Discord bot invite link isn’t configured. Contact support."
          />
        </>
      )}

      {type === 'JOIN_TELEGRAM' && (
        <>
          {!config.telegramBotUsername && (
            <Notice tone="error" title="Telegram checks won’t work yet">
              The DappDrop Telegram bot isn’t set up, so Telegram join tasks can’t be verified. Contact support.
            </Notice>
          )}
          <Controller
            control={control}
            name={`tasks.${index}.verificationData`}
            render={({ field, fieldState }) => (
              <Field id={fieldId(`tasks.${index}.verificationData`)} label="Telegram channel or group ID" help="The channel or group’s ID, or its username with @. The bot checks membership against it." error={fieldState.error?.message}>
                {(p) => <Input {...p} placeholder="e.g. @yourchannel or -100123456789" className="font-mono text-[0.875rem]" {...field} value={field.value ?? ''} />}
              </Field>
            )}
          />
          <HowTo summary="How to find your Telegram channel or group ID">
            <p>
              <strong className="font-semibold text-ink">A channel with a username:</strong> use @channelname.
            </p>
            <p>
              <strong className="font-semibold text-ink">A group or channel without one:</strong>
            </p>
            <p>1. Add @userinfobot to your group or channel.</p>
            <p>2. The bot shows the chat ID.</p>
            <p>3. Use that ID (it starts with -100).</p>
          </HowTo>
          <Controller
            control={control}
            name={`tasks.${index}.telegramInviteLink`}
            render={({ field, fieldState }) => (
              <Field id={fieldId(`tasks.${index}.telegramInviteLink`)} label="Telegram invite link" help="The link participants use to join your channel or group." error={fieldState.error?.message}>
                {(p) => <Input {...p} placeholder="e.g. https://t.me/yourchannel or https://t.me/+invitecode" {...field} value={field.value ?? ''} />}
              </Field>
            )}
          />
          <SetupChecklist
            title="Required: add the DappDrop bot to your channel or group"
            steps={[
              <>
                Add <span className="font-medium text-ink">@{config.telegramBotUsername || 'the DappDrop bot'}</span> to your channel or group.
              </>,
              'For a channel, make it an admin. In a group it can be a regular member.',
              'Make sure it can read messages and, for groups, see the member list.',
            ]}
            action={config.telegramBotUsername ? { label: `Open @${config.telegramBotUsername}`, href: `https://t.me/${config.telegramBotUsername}` } : undefined}
            missingActionText="The Telegram bot username isn’t configured. Contact support."
          />
        </>
      )}

      {type === 'ONCHAIN_TX' && (
        <>
          <Notice>On-chain payment tasks are in beta and may change.</Notice>
          <Controller
            control={control}
            name={`tasks.${index}.paymentRequired`}
            render={({ field }) => (
              <CheckRow
                checked={!!field.value}
                onCheckedChange={field.onChange}
                label="Require a payment"
                description="Participants complete this task by sending a payment, then submitting its transaction hash. We check it on-chain."
              />
            )}
          />
          {task?.paymentRequired && (
            <div className="grid gap-5 border-t border-rule pt-5">
              <Controller
                control={control}
                name={`tasks.${index}.paymentRecipient`}
                render={({ field, fieldState }) => (
                  <Field id={fieldId(`tasks.${index}.paymentRecipient`)} label="Pay to" help="The wallet that receives the payment." error={fieldState.error?.message}>
                    {(p) => <Input {...p} placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" className="font-mono text-[0.875rem]" autoComplete="off" spellCheck={false} {...field} value={field.value ?? ''} />}
                  </Field>
                )}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                {/* Locked to the deployment chain: a payment task on a Sepolia app must not ask for
                    mainnet funds. The value saved is set on submit, not taken from a field. */}
                <LockedField label="Network" value={DEPLOYMENT_CHAIN.name} reason="Payments are checked on the network this app runs on." />
                <Controller
                  control={control}
                  name={`tasks.${index}.tokenSymbol`}
                  render={({ field, fieldState }) => (
                    <Field id={fieldId(`tasks.${index}.tokenSymbol`)} label="Token" error={fieldState.error?.message}>
                      {(p) => <Input {...p} placeholder="ETH, USDC, DAI…" className="uppercase" {...field} value={field.value ?? ''} />}
                    </Field>
                  )}
                />
              </div>
              <Controller
                control={control}
                name={`tasks.${index}.tokenAddress`}
                render={({ field, fieldState }) => (
                  <Field id={fieldId(`tasks.${index}.tokenAddress`)} label="Token contract" optional help="Leave it empty for the network’s own token (ETH). For an ERC-20 token, enter its contract address." error={fieldState.error?.message}>
                    {(p) => <Input {...p} placeholder="0x… or leave empty" className="font-mono text-[0.875rem]" autoComplete="off" spellCheck={false} {...field} value={field.value ?? ''} />}
                  </Field>
                )}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <Controller
                  control={control}
                  name={`tasks.${index}.amount`}
                  render={({ field, fieldState }) => (
                    <Field id={fieldId(`tasks.${index}.amount`)} label="Amount" help="In whole units of the token, e.g. 0.001." error={fieldState.error?.message}>
                      {(p) => (
                        <Input
                          {...p}
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.001"
                          className="font-mono"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            field.onChange(e)
                            // Auto-populate the display format.
                            const tokenSymbol = form.getValues(`tasks.${index}.tokenSymbol`) || 'ETH'
                            if (e.target.value) {
                              form.setValue(`tasks.${index}.amountDisplay`, `${e.target.value} ${tokenSymbol}`)
                            }
                          }}
                        />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  control={control}
                  name={`tasks.${index}.amountDisplay`}
                  render={({ field, fieldState }) => (
                    <Field id={fieldId(`tasks.${index}.amountDisplay`)} label="Shown to participants as" help="Filled in from the amount; you can reword it." error={fieldState.error?.message}>
                      {(p) => <Input {...p} placeholder="0.001 ETH" {...field} value={field.value ?? ''} />}
                    </Field>
                  )}
                />
              </div>
            </div>
          )}
        </>
      )}

      {type === 'HUMANITY_VERIFICATION' && (
        <Controller
          control={control}
          name={`tasks.${index}.humanityPreset`}
          render={({ field, fieldState }) => {
            const selected: string[] = Array.isArray(field.value) ? field.value : field.value ? [field.value] : ['is_human']
            const toggle = (preset: string) => {
              const next = selected.includes(preset) ? selected.filter((p) => p !== preset) : [...selected, preset]
              // At least one preset is always selected.
              field.onChange(next.length > 0 ? next : ['is_human'])
            }
            const categories = [
              { key: 'identity', label: 'Identity' },
              { key: 'kyc', label: 'KYC' },
            ] as const
            return (
              <fieldset className="grid min-w-0 gap-3" id={fieldId(`tasks.${index}.humanityPreset`)} tabIndex={-1}>
                <legend className="text-[0.9375rem] font-semibold text-ink">
                  Required checks <span className="font-mono text-[0.8125rem] font-normal text-ink-3">· {selected.length} selected</span>
                </legend>
                <p className="-mt-1 text-[0.8125rem] text-ink-2">Participants must pass every check you select. Checked with Humanity Protocol.</p>
                {categories.map((cat) => {
                  const presets = HUMANITY_PRESETS.filter((p) => p.category === cat.key)
                  if (presets.length === 0) return null
                  return (
                    <div key={cat.key} className="grid gap-2">
                      <p className="dd-eyebrow">{cat.label}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {presets.map((p) => {
                          const isChecked = selected.includes(p.preset)
                          return (
                            <label
                              key={p.preset}
                              className={cn(
                                'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors [transition-duration:var(--dur-micro)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal',
                                isChecked ? 'border-ink bg-sunk' : 'border-rule-strong can-hover:hover:border-ink-2',
                              )}
                            >
                              <input type="checkbox" checked={isChecked} onChange={() => toggle(p.preset)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]" />
                              <span className="grid min-w-0 gap-0.5">
                                <span className="text-[0.9375rem] font-medium text-ink">{p.label}</span>
                                <span className="text-[0.8125rem] leading-snug text-ink-2">{p.description}</span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {fieldState.error?.message && <p className="text-[0.8125rem] text-danger">! {fieldState.error.message}</p>}
              </fieldset>
            )
          }}
        />
      )}

      <div className="grid gap-2 border-t border-rule pt-4">
        <Controller
          control={control}
          name={`tasks.${index}.isOptional`}
          render={({ field }) => (
            <CheckRow
              checked={!!field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              label="Optional: participants can skip this task"
              description="They still qualify for the reward without it."
            />
          )}
        />
        {selfReported && !task?.isOptional && (
          <Notice tone="attention">
            This task is required but self-reported: anyone can confirm it without doing it, so making it required doesn’t keep bots out. Consider making it optional.
          </Notice>
        )}
      </div>
    </fieldset>
  )
}

function HowTo({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="-mt-2 text-[0.875rem]">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-ink-2 underline decoration-rule-strong underline-offset-4 can-hover:hover:text-ink">{summary}</summary>
      <div className="mt-1 grid gap-1 text-[0.8125rem] leading-relaxed text-ink-2">{children}</div>
    </details>
  )
}
