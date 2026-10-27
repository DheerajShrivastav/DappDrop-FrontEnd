'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button, buttonClass } from '@/components/app/button'
import { Field, InlineError, Input } from '@/components/app/field'
import { VerificationChip } from '@/components/app/chip'
import { KeyValueList } from '@/components/app/kv-list'
import { LinkedAccountPanel } from '@/components/linked-account-panel'
import { XHandleField } from '@/components/x-handle-field'
import type { Task, TaskType } from '@/lib/types'
import { TASK_VERIFICATION_METHOD } from '@/lib/task-types'
import { xIntentFor, xTargetForTask } from '@/lib/x-intents'
import { parseXPostUrl } from '@/lib/x-task-fields'

interface TaskVerificationFormProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  taskId: string | null
  taskType: TaskType
  campaignId: string
  /** The task being verified: its text, and the host's X fields for the X tasks. */
  task?: Task | null
  /** No identity data: the server checks the account linked to the signed-in wallet (#44).
   * `extra` carries only task inputs (the SOCIAL_POST post link, #45). */
  onVerify: (taskId: string, taskType: TaskType, extra?: { postUrl?: string }) => Promise<void>
}

const X_GATE_MS = 5_000

type PostCode = { state: 'loading' } | { state: 'ready'; code: string } | { state: 'error'; message: string }

/**
 * The task dialog behind a task row's [Start] (app-design §1.8, §1.13), in the Monolith design.
 * Behaviour is #44's and #45's, unchanged:
 * - Discord / Telegram: the participant links the account on the server (OAuth / Login Widget);
 *   the membership check runs only for that linked account, and nothing identifying is sent from
 *   here. The check button unlocks only once an account is linked.
 * - SOCIAL_POST (proof-by-post): a per-wallet code, the host's required text, the participant's
 *   saved X handle and the post link; the server reads the public post and checks all three.
 * - Follow / like / repost: self-reported, said so, with a short "open X first" friction gate.
 * - WALLET_CONNECT: the signed-in wallet session is the proof.
 *
 * Errors aren't shown here: the page closes the dialog and reports the reason on the task row
 * ("! Couldn't verify: …" + [Try again]) and in a toast.
 */
export function TaskVerificationForm({ isOpen, onOpenChange, taskId, taskType, campaignId, task, onVerify }: TaskVerificationFormProps) {
  const [isVerifying, setIsVerifying] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  // Discord / Telegram: the check unlocks once an account is linked to this wallet server-side.
  const [accountLinked, setAccountLinked] = useState(false)

  // SOCIAL_POST (proof-by-post)
  const [postCode, setPostCode] = useState<PostCode>({ state: 'loading' })
  const [postUrl, setPostUrl] = useState('')
  const [savedXHandle, setSavedXHandle] = useState<string | null>(null)
  useEffect(() => {
    if (!isOpen || taskType !== 'SOCIAL_POST') return
    let cancelled = false
    setPostCode({ state: 'loading' })
    const failed = 'Your code didn’t load. Close this and try again.'
    fetch(`/api/tasks/post-code?campaignId=${encodeURIComponent(campaignId)}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (cancelled) return
        if (r.ok && typeof d?.code === 'string') setPostCode({ state: 'ready', code: d.code })
        else setPostCode({ state: 'error', message: r.status === 401 ? 'Sign in with your wallet to get your code.' : failed })
      })
      .catch(() => {
        if (!cancelled) setPostCode({ state: 'error', message: failed })
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, taskType, campaignId])

  // Self-reported tasks: "I've done it" unlocks only after the participant has opened the task on
  // X, plus a few seconds. FRICTION, NOT SECURITY: it's client-side and trivially bypassed, and the
  // backend still attests self-reported tasks on the participant's word. It only stops the
  // reflexive "confirm without doing anything" path. Kept per task in sessionStorage so closing and
  // reopening the dialog doesn't reset it.
  const xClickKey = taskId ? `x_task_opened_${campaignId}_${taskId}` : null
  const [xOpenedAt, setXOpenedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isOpen || !xClickKey) return
    try {
      const v = sessionStorage.getItem(xClickKey)
      setXOpenedAt(v ? Number(v) : null)
    } catch {
      setXOpenedAt(null)
    }
  }, [isOpen, xClickKey])
  useEffect(() => {
    if (!isOpen || xOpenedAt === null) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [isOpen, xOpenedAt])
  const markXOpened = () => {
    const t = Date.now()
    setXOpenedAt((prev) => prev ?? t)
    setNow(t)
    try {
      if (xClickKey && !sessionStorage.getItem(xClickKey)) sessionStorage.setItem(xClickKey, String(t))
    } catch {
      // storage unavailable (private mode): the in-memory state still gates this dialog
    }
  }
  const gateRemaining = xOpenedAt === null ? null : Math.max(0, X_GATE_MS - (now - xOpenedAt))

  const handleVerification = async () => {
    if (!taskId) return
    setIsVerifying(true)
    try {
      // No identity data is passed: the server uses the account linked to the signed-in wallet.
      await onVerify(taskId, taskType, taskType === 'SOCIAL_POST' ? { postUrl: postUrl.trim() } : undefined)
    } catch (error) {
      console.error('Verification error:', error)
    } finally {
      setIsVerifying(false)
      onOpenChange(false)
    }
  }

  const notNow = (
    <DialogClose asChild>
      <Button variant="secondary" disabled={isVerifying}>
        Not now
      </Button>
    </DialogClose>
  )

  /** What the participant does, and how it's checked (the row's chip, repeated). */
  const taskLine = task?.description ? (
    <div className="grid gap-2 border-y border-rule py-4">
      <p className="text-body font-medium text-ink [overflow-wrap:anywhere]">{task.description}</p>
      <span>
        <VerificationChip method={TASK_VERIFICATION_METHOD[taskType]} withNote />
      </span>
    </div>
  ) : null

  const renderVerificationForm = () => {
    switch (taskType) {
      case 'JOIN_DISCORD':
      case 'JOIN_TELEGRAM': {
        const isDiscord = taskType === 'JOIN_DISCORD'
        const name = isDiscord ? 'Discord' : 'Telegram'
        return (
          <>
            <DialogHeader>
              <DialogTitle>{isDiscord ? 'Join the Discord server' : 'Join the Telegram group'}</DialogTitle>
              <DialogDescription>
                {isDiscord
                  ? 'Join the server, then connect your Discord account. Our bot checks that this account is a member.'
                  : 'Join the channel or group, then sign in with Telegram. Our bot checks that this account is in it.'}
              </DialogDescription>
            </DialogHeader>
            {taskLine}
            <LinkedAccountPanel key={taskType} platform={isDiscord ? 'discord' : 'telegram'} onLinkedChange={setAccountLinked} />
            <DialogFooter>
              {notNow}
              <Button onClick={handleVerification} loading={isVerifying} disabled={!accountLinked} disabledReason={`Connect your ${name} account first.`}>
                {isVerifying ? 'Checking…' : 'Check my membership'}
              </Button>
            </DialogFooter>
          </>
        )
      }

      // SOCIAL_POST: proof-by-post, a real check (src/lib/x-proof.ts).
      case 'SOCIAL_POST': {
        const required = task?.metadata?.xRequiredText ?? null
        const code = postCode.state === 'ready' ? postCode.code : null
        const composeText = [required, code].filter(Boolean).join(' ')
        const urlOk = !!parseXPostUrl(postUrl)
        const reason = !savedXHandle ? 'Save your X handle first.' : !urlOk ? 'Paste the link to your post.' : undefined
        return (
          <>
            <DialogHeader>
              <DialogTitle>Write a post on X</DialogTitle>
              <DialogDescription>
                Post on X with your code{required ? ' and the required text' : ''}, then paste the link to your post. We check it automatically.
              </DialogDescription>
            </DialogHeader>
            {taskLine}
            <div className="grid gap-3">
              <KeyValueList
                items={[
                  ...(required ? [{ label: 'Must include', value: <span className="[overflow-wrap:anywhere]">{required}</span> }] : []),
                  { label: 'Your code', value: <span className="font-mono">{code ?? (postCode.state === 'loading' ? 'Loading…' : 'Not available')}</span> },
                ]}
              />
              {postCode.state === 'error' && <InlineError>{postCode.message}</InlineError>}
              {code && (
                <a
                  href={`https://x.com/intent/post?text=${encodeURIComponent(composeText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass({ variant: 'secondary', block: true })}
                >
                  Write the post on X <span aria-hidden="true">↗</span>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </div>
            <XHandleField required onSavedChange={setSavedXHandle} />
            <Field label="Link to your post" help={`The post must be public and written by @${savedXHandle ?? 'your saved handle'}.`}>
              {(p) => (
                <Input
                  {...p}
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  placeholder="https://x.com/you/status/1234567890"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="url"
                />
              )}
            </Field>
            <DialogFooter>
              {notNow}
              <Button onClick={handleVerification} loading={isVerifying} disabled={!!reason} disabledReason={reason}>
                {isVerifying ? 'Checking…' : 'Check my post'}
              </Button>
            </DialogFooter>
          </>
        )
      }

      // WALLET_CONNECT: the signed-in wallet session is the proof (verify-task attests it with
      // method 'siwe-session' for the session wallet only), a real check, so no X gate.
      case 'WALLET_CONNECT':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Confirm your wallet</DialogTitle>
              <DialogDescription>Your signed-in wallet is the proof. Confirm to record it for this task.</DialogDescription>
            </DialogHeader>
            {taskLine}
            <DialogFooter>
              {notNow}
              <Button onClick={handleVerification} loading={isVerifying}>
                {isVerifying ? 'Recording…' : 'Confirm'}
              </Button>
            </DialogFooter>
          </>
        )

      // Self-reported (no automatic X check): the backend attests these for the signed-in wallet
      // on the participant's word, recorded as 'self-reported' in the audit log.
      case 'SOCIAL_FOLLOW':
      case 'SOCIAL_LIKE':
      case 'RETWEET': {
        const copy: Record<string, { title: string; instruction: string }> = {
          SOCIAL_FOLLOW: { title: 'Follow on X', instruction: 'Follow the account on X, then come back and confirm.' },
          SOCIAL_LIKE: { title: 'Like on X', instruction: 'Like the post on X, then come back and confirm.' },
          RETWEET: { title: 'Repost on X', instruction: 'Repost the post on X, then come back and confirm.' },
        }
        const { title, instruction } = copy[taskType]
        // Only validated handles / numeric post ids ever reach the link (see x-intents.ts).
        const intent = xIntentFor(taskType, xTargetForTask(task))
        const unlocked = gateRemaining === 0
        const reason = gateRemaining === null ? 'Open the task on X first.' : unlocked ? undefined : `Available in ${Math.ceil(gateRemaining / 1000)} s.`
        return (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{instruction}</DialogDescription>
            </DialogHeader>
            {taskLine}
            <a href={intent.href} target="_blank" rel="noopener noreferrer" onClick={markXOpened} className={buttonClass({ variant: 'secondary', block: true })}>
              {intent.label} <span aria-hidden="true">↗</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <XHandleField />
            <p className="text-small text-ink-2">This task is self-reported: it can’t be checked automatically yet. Only confirm once you’ve done it.</p>
            <DialogFooter>
              {notNow}
              <Button onClick={handleVerification} loading={isVerifying} disabled={!unlocked} disabledReason={reason}>
                {isVerifying ? 'Recording…' : 'I’ve done it'}
              </Button>
            </DialogFooter>
          </>
        )
      }

      default:
        return (
          <>
            <DialogHeader>
              <DialogTitle>Not available here</DialogTitle>
              <DialogDescription>This task type can’t be checked from this page.</DialogDescription>
            </DialogHeader>
            <DialogFooter>{notNow}</DialogFooter>
          </>
        )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(next) => (isVerifying ? undefined : onOpenChange(next))}>
      <DialogContent
        ref={contentRef}
        // Focused programmatically on open (below): the title is the cue, not a ring round the card.
        className="focus:outline-none"
        aria-busy={isVerifying}
        data-task-dialog={taskType}
        onOpenAutoFocus={(e) => {
          // Start on the dialog itself (its title is read first), not on "Not now" or whichever
          // control happens to come first while the linked account is still loading.
          e.preventDefault()
          contentRef.current?.focus()
        }}
      >
        {renderVerificationForm()}
      </DialogContent>
    </Dialog>
  )
}
