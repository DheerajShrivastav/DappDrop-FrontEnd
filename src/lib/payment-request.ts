/**
 * What a payment task (ONCHAIN_TX with paymentRequired) asks a participant to send, read from the
 * task's off-chain metadata (the same record /api/tasks/verify-payment checks against). Pure: no
 * wallet, no network, so it's unit-tested (payment-request.test.ts).
 */
import type { Task } from '@/lib/types'
import { isNativePaymentToken, toBaseUnits } from '@/lib/payment-verification'

export type PaymentRequest = {
  recipient: string
  /** Whole token units, e.g. "0.001". */
  amount: string
  /** What participants see, e.g. "0.001 ETH". Always built from `amount` + `tokenSymbol`, never
   * the host's free-text "Shown to participants as", which could say less than the real charge. */
  amountDisplay: string
  /** null = the network's own token (ETH). */
  tokenAddress: string | null
  tokenSymbol: string
  chainId: number
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** The payment a task asks for, or null when it isn't a payment task or its settings are
 * incomplete (a participant must never be asked to send to a malformed address or amount). */
export function paymentRequestFromTask(task: Pick<Task, 'type' | 'metadata'>, fallbackChainId: number): PaymentRequest | null {
  const m = task.metadata
  if (task.type !== 'ONCHAIN_TX' || !m?.paymentRequired) return null
  if (!m.paymentRecipient || !ADDRESS.test(m.paymentRecipient)) return null
  const native = isNativePaymentToken(m.tokenAddress)
  if (!native && !ADDRESS.test(m.tokenAddress as string)) return null
  // ERC-20 decimals are only known on-chain; 18 here just checks the amount is a positive decimal.
  if (!m.amount || toBaseUnits(m.amount, 18) === null) return null
  const tokenSymbol = m.tokenSymbol?.trim() || (native ? 'ETH' : 'tokens')
  return {
    recipient: m.paymentRecipient,
    amount: m.amount.trim(),
    amountDisplay: `${m.amount.trim()} ${tokenSymbol}`,
    tokenAddress: native ? null : (m.tokenAddress as string),
    tokenSymbol,
    chainId: m.chainId ?? fallbackChainId,
  }
}

/** localStorage key for a payment that was sent but not yet confirmed as verified, so a retry
 * re-checks that transaction instead of asking the participant to pay twice. */
export function pendingPaymentKey(campaignId: string, taskId: string, wallet: string): string {
  return `dd-payment-tx:${campaignId}:${taskId}:${wallet.toLowerCase()}`
}

export const TX_HASH = /^0x[0-9a-fA-F]{64}$/
