'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useSwitchChain } from 'wagmi'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button, Spinner } from '@/components/app/button'
import { Input, InlineError } from '@/components/app/field'
import { KeyValueList } from '@/components/app/kv-list'
import { shortAddress } from '@/components/app/format'
import { deploymentChainFor } from '@/lib/deployment-chain'
import { pendingPaymentKey, TX_HASH, type PaymentRequest } from '@/lib/payment-request'
import { sendTaskPayment, verifyTaskPayment, WrongNetworkError, type PaymentVerifyResult } from '@/lib/payment-task-client'

type Step =
  | { kind: 'ready' }
  | { kind: 'wrong-network' }
  | { kind: 'confirm-in-wallet' }
  | { kind: 'confirming'; hash: string }
  | { kind: 'checking'; hash: string }
  | { kind: 'recording' }

const readPending = (key: string): string | null => {
  try {
    const v = window.localStorage.getItem(key)
    return v && TX_HASH.test(v) ? v : null
  } catch {
    return null
  }
}
const writePending = (key: string, hash: string | null) => {
  try {
    if (hash) window.localStorage.setItem(key, hash)
    else window.localStorage.removeItem(key)
  } catch {
    // Storage blocked: the retry then asks for the hash instead (the paste path).
  }
}

/**
 * The payment task (ONCHAIN_TX) dialog. Before this, the page set a payment-dialog state that
 * nothing rendered, so payment tasks could never be completed (phase2-A-handoff.md).
 *
 * Pay → the wallet sends the exact amount to the host's address → the server checks that
 * transaction (from this wallet, to that address, that amount, on this network) and signs the
 * completion → `onVerified` records it on-chain (or the backend already has).
 *
 * A sent-but-unchecked payment is remembered per campaign / task / wallet, so a retry re-checks
 * that transaction rather than asking anyone to pay twice. A payment made outside the app can be
 * checked by pasting its transaction hash.
 */
export function PaymentTaskDialog({
  open,
  onOpenChange,
  campaignId,
  taskId,
  taskIndex,
  taskDescription,
  request,
  address,
  onVerified,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId: string
  taskId: string
  taskIndex: number
  taskDescription: string
  request: PaymentRequest
  address: string
  /** Record the completion (self-submit the attestation if the backend didn't). Throws on failure. */
  onVerified: (result: PaymentVerifyResult) => Promise<void>
}) {
  const storageKey = pendingPaymentKey(campaignId, taskId, address)
  const chain = deploymentChainFor(request.chainId)
  const { switchChainAsync } = useSwitchChain()
  const hashInputId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)

  const [step, setStep] = useState<Step>({ kind: 'ready' })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [showPaste, setShowPaste] = useState(false)
  const [pasted, setPasted] = useState('')

  useEffect(() => {
    if (!open) return
    setStep({ kind: 'ready' })
    setError(null)
    setShowPaste(false)
    setPasted('')
    setPending(readPending(storageKey))
  }, [open, storageKey])

  const busy = step.kind !== 'ready' && step.kind !== 'wrong-network'

  const check = async (hash: string) => {
    setError(null)
    setStep({ kind: 'checking', hash })
    try {
      const result = await verifyTaskPayment(campaignId, taskIndex, hash, address)
      setStep({ kind: 'recording' })
      await onVerified(result)
      writePending(storageKey, null)
      setPending(null)
      onOpenChange(false)
    } catch (e) {
      // Keep the hash: the payment went through, only the check or the recording didn't.
      setPending(hash)
      setError(e instanceof Error ? e.message : 'The payment couldn’t be checked.')
      setStep({ kind: 'ready' })
    }
  }

  const pay = async () => {
    setError(null)
    setStep({ kind: 'confirm-in-wallet' })
    let sent: string | null = null
    try {
      const hash = await sendTaskPayment(request, (h) => {
        sent = h
        writePending(storageKey, h)
        setPending(h)
        setStep({ kind: 'confirming', hash: h })
      })
      await check(hash)
    } catch (e) {
      if (e instanceof WrongNetworkError) {
        setStep({ kind: 'wrong-network' })
        return
      }
      const raw = e instanceof Error ? e.message : String(e)
      const rejected = /user rejected|user denied|ACTION_REJECTED/i.test(raw)
      setError(rejected ? 'You cancelled the payment in your wallet. Nothing was sent.' : sent ? `The payment was sent but hasn’t confirmed yet: ${raw}` : raw)
      setStep({ kind: 'ready' })
    }
  }

  const switchNetwork = async () => {
    setError(null)
    try {
      await switchChainAsync({ chainId: request.chainId })
      setStep({ kind: 'ready' })
    } catch {
      setError(`Your wallet didn’t switch. Switch to ${chain.name} in your wallet, then try again.`)
    }
  }

  const pastedValid = TX_HASH.test(pasted.trim())

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent
        aria-busy={busy}
        onOpenAutoFocus={(e) => {
          // Start on the main action, not the first button in the DOM ("I paid already").
          e.preventDefault()
          primaryRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Pay {request.amountDisplay}</DialogTitle>
          <DialogDescription>{taskDescription}</DialogDescription>
        </DialogHeader>

        <KeyValueList
          items={[
            { label: 'Amount', value: request.amountDisplay },
            // The symbol is the host's text; the contract is what actually moves.
            ...(request.tokenAddress ? [{ label: 'Token contract', value: shortAddress(request.tokenAddress), title: request.tokenAddress }] : []),
            { label: 'Pay to', value: shortAddress(request.recipient), title: request.recipient },
            { label: 'Network', value: chain.name },
          ]}
        />
        <p className="text-small text-ink-2">
          This sends a real transaction from your wallet straight to the host’s address. DappDrop never holds it. The network fee is extra.
        </p>

        {pending && !busy && (
          <p className="text-small text-ink-2">
            You already sent a payment for this task (<span className="font-mono">{shortAddress(pending, 'short')}</span>). Check it instead of paying again.
          </p>
        )}

        {step.kind === 'wrong-network' && <p className="text-small text-ink">Your wallet is on a different network. This payment is checked on {chain.name}.</p>}

        {busy && (
          <p className="inline-flex items-center gap-2 font-mono text-[0.8125rem] text-ink-2" role="status">
            <Spinner />
            {step.kind === 'confirm-in-wallet' && 'Confirm the payment in your wallet…'}
            {step.kind === 'confirming' && 'Waiting for the network to confirm it…'}
            {step.kind === 'checking' && 'Checking the payment…'}
            {step.kind === 'recording' && 'Recording the task on-chain…'}
          </p>
        )}

        {error && <InlineError>{error}</InlineError>}

        {showPaste && !busy && (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (pastedValid) check(pasted.trim())
            }}
          >
            <label htmlFor={hashInputId} className="text-[0.9375rem] font-semibold text-ink">
              Transaction hash
            </label>
            <Input id={hashInputId} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="0x…" className="font-mono" autoComplete="off" spellCheck={false} />
            <p className="text-[0.8125rem] text-ink-2">The payment must come from your connected wallet, for the exact amount, on {chain.name}.</p>
            <div>
              <Button type="submit" size="sm" variant="secondary" disabled={!pastedValid}>
                Check this payment
              </Button>
            </div>
          </form>
        )}

        <DialogFooter>
          {!busy && !showPaste && (
            <Button variant="ghost" onClick={() => setShowPaste(true)}>
              I paid already
            </Button>
          )}
          {step.kind === 'wrong-network' ? (
            <Button ref={primaryRef} onClick={switchNetwork}>Switch to {chain.name}</Button>
          ) : pending ? (
            <Button ref={primaryRef} onClick={() => check(pending)} disabled={busy}>
              {busy ? 'Working…' : 'Check my payment'}
            </Button>
          ) : (
            <Button ref={primaryRef} onClick={pay} disabled={busy}>
              {busy ? 'Working…' : `Pay ${request.amountDisplay}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
