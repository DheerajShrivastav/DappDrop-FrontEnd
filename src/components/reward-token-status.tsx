'use client'

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import type { RewardTokenCheck } from '@/hooks/use-reward-token-check'
import { chainName, formatTokenAmount, parseTokenAmount } from '@/lib/reward-plan'
import { cn } from '@/lib/utils'

export type TokenVerdict = {
  tone: 'checking' | 'ok' | 'warn' | 'block'
  /** One line under the address field. */
  message: string
  /** Set when continuing would let a transaction revert AFTER createCampaign has mined. */
  blocking: string | null
}

/**
 * Turns the token pre-flight into a verdict. Shared by the status line under the address field
 * and the step's Next guard, so what the host sees and what stops them are the same thing.
 *
 * Only DEFINITE negatives block (no contract, wrong kind, too many decimals, not enough balance,
 * NFTs not owned). An RPC error is "unknown" and warns without blocking — a flaky node shouldn't
 * trap a host on this step.
 */
export function tokenVerdict(
  check: RewardTokenCheck,
  ctx: {
    kind: 'ERC20' | 'ERC721' | 'ERC1155'
    chainId: number
    /** ERC20: the gross pool amount as typed. */
    amount?: string
    connected: boolean
  },
): TokenVerdict | null {
  if (check.status === 'idle') return null
  if (check.status === 'checking') return { tone: 'checking', message: 'Checking this token…', blocking: null }
  const r = check.result
  const net = chainName(ctx.chainId)

  if (r.kind === 'error') {
    return {
      tone: 'warn',
      message: `Couldn't check this token right now (network error). Double-check the address is on ${net}.`,
      blocking: null,
    }
  }
  if (r.kind === 'not_contract') {
    const m = `There's no token contract at this address on ${net} — it may be a wallet address, or a token on another network.`
    return { tone: 'block', message: m, blocking: m }
  }
  if (r.kind === 'not_erc20') {
    const m = "This contract isn't an ERC20 token (it has no decimals or symbol)."
    return { tone: 'block', message: m, blocking: m }
  }

  if (r.kind === 'erc20') {
    const base = `${r.symbol} · ${r.decimals} decimals`
    const parsed = ctx.amount?.trim() ? parseTokenAmount(ctx.amount, r.decimals) : null
    if (parsed && !parsed.ok && parsed.reason === 'precision') {
      return { tone: 'block', message: `${base}. ${parsed.message}`, blocking: parsed.message }
    }
    if (r.balance === null) {
      return {
        tone: 'ok',
        message: ctx.connected ? `${base}.` : `${base}. Connect your wallet to check your balance.`,
        blocking: null,
      }
    }
    const held = `You hold ${formatTokenAmount(r.balance, r.decimals)} ${r.symbol}`
    if (parsed?.ok && r.balance < parsed.value) {
      const m = `${held} — less than the ${formatTokenAmount(parsed.value, r.decimals)} ${r.symbol} pool, so funding would fail.`
      return { tone: 'block', message: `${base} · ${m}`, blocking: m }
    }
    return { tone: 'ok', message: `${base} · ${held}.`, blocking: null }
  }

  // NFT
  if (!r.standardMatches) {
    const m = `This contract doesn't report itself as ${ctx.kind}. Check the address and the standard selected above.`
    return { tone: 'block', message: m, blocking: m }
  }
  if (!ctx.connected) {
    return { tone: 'ok', message: `${ctx.kind} contract. Connect your wallet to check you own these tokens.`, blocking: null }
  }
  if (r.notOwned.length) {
    const list = r.notOwned.slice(0, 5).join(', ') + (r.notOwned.length > 5 ? ` and ${r.notOwned.length - 5} more` : '')
    const m =
      ctx.kind === 'ERC1155'
        ? `You don't hold enough of token ID${r.notOwned.length > 1 ? 's' : ''} ${list} for the quantities listed.`
        : `You don't own token ID${r.notOwned.length > 1 ? 's' : ''} ${list}.`
    return { tone: 'block', message: `${ctx.kind} contract · ${m}`, blocking: m }
  }
  if (r.total === 0) return { tone: 'ok', message: `${ctx.kind} contract.`, blocking: null }
  const partial = r.checked < r.total ? ` (checked the first ${r.checked} of ${r.total})` : ''
  return { tone: 'ok', message: `${ctx.kind} contract · You own every token listed${partial}.`, blocking: null }
}

export function RewardTokenStatus({ verdict }: { verdict: TokenVerdict | null }) {
  if (!verdict) return null
  const Icon =
    verdict.tone === 'checking' ? Loader2 : verdict.tone === 'ok' ? CheckCircle2 : verdict.tone === 'warn' ? AlertTriangle : XCircle
  return (
    <p
      className={cn(
        'flex items-start gap-2 text-sm',
        verdict.tone === 'block' ? 'text-destructive' : 'text-muted-foreground',
      )}
      aria-live="polite"
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', verdict.tone === 'checking' && 'animate-spin')} />
      <span>{verdict.message}</span>
    </p>
  )
}
