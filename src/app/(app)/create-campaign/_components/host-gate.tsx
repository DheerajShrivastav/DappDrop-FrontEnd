'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { Button, Chip, KeyValueList, PageContainer, PageHeader, Panel, Skeleton, Spinner, shortAddress } from '@/components/app'
import { becomeHost, getProtocolFeeBps } from '@/lib/web3-service'
import { describeContractError } from '@/lib/contract-errors'
import { platformFeeLine } from '@/lib/protocol-fee'
import appConfig from '@/app/config'
import { DEPLOYMENT_CHAIN } from '@/lib/deployment-chain'
import { claims } from '@/config/claims'
import { network, networkLabel } from '@/config/landing'
import { cn } from '@/lib/utils'

export type GateState = { kind: 'idle' } | { kind: 'pending' } | { kind: 'failed'; reason: string } | { kind: 'granted' }

/**
 * Plain-language reason for a failed host-role transaction. The service also raises a toast
 * with the mapped contract revert; this is the inline state so the gate is never a dead end.
 * The revert is decoded by custom error (EnforcedPause since contracts PR #26, not the old
 * "Contract is paused" string), via the shared helper.
 */
export function hostRoleFailureReason(error: unknown, gasSymbol: string): string {
  const d = describeContractError(error, { gasSymbol })
  if (d.kind === 'rejected') return 'You cancelled in your wallet. Nothing was sent.'
  if (d.kind === 'gas') {
    return `This wallet doesn’t have enough ${gasSymbol} for gas. Get a little from a faucet, then try again.`
  }
  if (d.name === 'EnforcedPause') return 'DappDrop is paused for maintenance. Try again later.'
  if (d.name) return d.message
  return 'The transaction didn’t go through. The notification has the details; you can try again.'
}

/** For the dev fixture only (screenshots and gates of wallet-only states). */
export type HostGatePreview = {
  connection: 'none' | 'connected' | 'wrong-network' | 'checking'
  state: GateState
}

/**
 * /create-campaign when the wallet doesn't hold the host role yet (app-design §2.4, mockup
 * host-gate.html): a 3-step checklist with [Connect wallet] inside the gate (step 01), then one
 * transaction that grants the host role (step 02), then the wizard (step 03). Waiting, failed and
 * added states are shown in place, in words.
 */
export function HostGate({
  isConnected,
  address,
  onGranted,
  checking = false,
  preview,
}: {
  isConnected: boolean
  address: string | null
  onGranted: () => Promise<void> | void
  /** Connected, and the role check hasn't answered yet: step 02 is a placeholder, not a button. */
  checking?: boolean
  preview?: HostGatePreview
}) {
  const [liveState, setState] = useState<GateState>({ kind: 'idle' })
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const { openConnectModal } = useConnectModal()
  const gas = DEPLOYMENT_CHAIN.gasSymbol
  // The platform fee line (app-design §3.3). Starts from the address book (no fee module → 0,
  // "None during beta"), then the chain's answer replaces it. Skipped in the dev fixture.
  const [feeBps, setFeeBps] = useState<number | null | undefined>(appConfig.addresses.feeModule ? undefined : 0)
  useEffect(() => {
    if (preview) return
    let cancelled = false
    getProtocolFeeBps().then((bps) => !cancelled && setFeeBps(bps))
    return () => {
      cancelled = true
    }
  }, [preview])

  const state = preview?.state ?? liveState
  const connected = preview ? preview.connection !== 'none' : isConnected
  const wrongNetwork = preview ? preview.connection === 'wrong-network' : isConnected && chainId !== undefined && chainId !== DEPLOYMENT_CHAIN.id
  const roleChecking = preview ? preview.connection === 'checking' : checking

  const handleBecomeHost = async () => {
    if (preview || !isConnected || !address) return
    setState({ kind: 'pending' })
    try {
      await becomeHost()
      setState({ kind: 'granted' })
      // The role re-check swaps this gate for the wizard. If it can't confirm the role, the
      // gate stays, back at the start of step 02 (as before).
      await onGranted()
      setState({ kind: 'idle' })
    } catch (error) {
      setState({ kind: 'failed', reason: hostRoleFailureReason(error, gas) })
    }
  }

  const step2Now = connected && !roleChecking
  const faucet = DEPLOYMENT_CHAIN.isTestnet ? (
    claims.faucetUrl ? (
      <>
        {' '}
        No {gas}?{' '}
        <a className="dd-link" href={claims.faucetUrl} target="_blank" rel="noopener noreferrer">
          Get some from a faucet<span aria-hidden="true"> ↗</span>
        </a>
      </>
    ) : (
      <> No {gas}? Get some from any Sepolia faucet first.</>
    )
  ) : null

  let step2Action: React.ReactNode
  if (!connected) {
    step2Action = (
      <Button size="sm" disabled disabledReason="Connect a wallet first.">
        Get the host role
      </Button>
    )
  } else if (roleChecking) {
    step2Action = <Skeleton className="h-11 w-40 rounded-full" />
  } else if (wrongNetwork) {
    step2Action = (
      <Button size="sm" onClick={() => switchChain({ chainId: DEPLOYMENT_CHAIN.id })}>
        Switch to {network.name}
      </Button>
    )
  } else if (state.kind === 'pending') {
    step2Action = (
      <Button size="sm" loading>
        Waiting for your wallet…
      </Button>
    )
  } else if (state.kind === 'granted') {
    step2Action = null
  } else {
    step2Action = (
      <Button size="sm" onClick={handleBecomeHost}>
        {state.kind === 'failed' ? 'Try again' : 'Get the host role'}
      </Button>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Start a campaign · one-time setup"
        title="Two steps before your first campaign."
        lead="Connect the wallet you’ll fund campaigns from, then give it the host role. You do this once per wallet."
      />

      <div className="mt-11 grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-label="Setup">
          <ol className="border-b border-rule" data-host-gate-steps>
            <GateStep
              n="01"
              state={connected ? 'done' : 'now'}
              title="Connect a wallet"
              body={
                connected && address ? (
                  <>
                    Connected as{' '}
                    <span className="font-mono text-ink" title={address}>
                      {shortAddress(address)}
                    </span>
                    {wrongNetwork ? `, on another network. DappDrop runs on ${networkLabel}.` : '.'}
                  </>
                ) : (
                  <>Use the wallet that will fund your campaigns. It must be on {networkLabel}. We’ll never ask for your seed phrase.</>
                )
              }
              action={
                connected ? null : (
                  <Button size="sm" onClick={() => openConnectModal?.()}>
                    Connect wallet
                  </Button>
                )
              }
            />
            <GateStep
              n="02"
              state={state.kind === 'granted' ? 'done' : step2Now ? 'now' : 'later'}
              title="Get the host role"
              body={
                <>
                  One transaction that lets this wallet create campaigns. You pay only the network gas, a little {gas}.{faucet}
                </>
              }
              action={step2Action}
            >
              {roleChecking && (
                <p className="text-[0.875rem] text-ink-2" role="status">
                  Checking whether this wallet already has the host role…
                </p>
              )}
              {step2Now && !wrongNetwork && state.kind === 'pending' && (
                <div className="grid justify-items-start gap-2" role="status">
                  <Chip variant="ended">
                    <Spinner className="h-2.5 w-2.5 border-[1.5px]" />
                    Waiting for your wallet
                  </Chip>
                  <p className="text-[0.875rem] text-ink-2">
                    Confirm the transaction in your wallet. Nothing is sent until you do. After that it usually takes under a minute; keep this page open.
                  </p>
                </div>
              )}
              {step2Now && !wrongNetwork && state.kind === 'failed' && (
                <div className="grid justify-items-start gap-2" role="alert">
                  <Chip variant="error" mark="!">
                    Didn’t go through
                  </Chip>
                  <p className="text-[0.875rem] text-ink-2">{state.reason}</p>
                </div>
              )}
              {state.kind === 'granted' && (
                <div className="grid justify-items-start gap-2" role="status">
                  <Chip variant="check" mark="✓">
                    Host role added
                  </Chip>
                  <p className="text-[0.875rem] text-ink-2">This wallet can now create campaigns. Taking you to the first step…</p>
                </div>
              )}
            </GateStep>
            <GateStep
              n="03"
              state="later"
              title="Create your campaign"
              body="Name it, add tasks, set the reward and fund the escrow. It starts as a draft; you open it when you’re ready."
            />
          </ol>
        </section>

        <Panel as="aside" aria-label="What hosting costs" eyebrow="What hosting costs">
          <KeyValueList
            items={[
              { label: 'Host role', value: 'Gas only' },
              { label: 'Platform fee', value: platformFeeLine(feeBps, claims.feeCapEnforced) },
              { label: 'Your reward', value: 'In escrow' },
            ]}
          />
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-2">
            You fund the reward into the escrow contract before the campaign opens. DappDrop never holds it.
          </p>
          <p className="mt-5 grid justify-items-start gap-2 text-small">
            <Link className="dd-link" href="/how-it-works" prefetch={false}>
              How a campaign runs
            </Link>
            <Link className="dd-link" href="/security" prefetch={false}>
              What we can and can’t do
            </Link>
          </p>
        </Panel>
      </div>
    </PageContainer>
  )
}

function GateStep({
  n,
  state,
  title,
  body,
  action,
  children,
}: {
  n: string
  state: 'done' | 'now' | 'later'
  title: string
  body: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <li
      aria-current={state === 'now' ? 'step' : undefined}
      className={cn('grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-3 py-5 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-start', state === 'now' ? 'border-t-2 border-signal' : 'border-t border-rule')}
    >
      <span className={cn('pt-0.5 font-mono text-[0.8125rem]', state === 'now' ? 'text-signal' : 'text-ink-3')}>{n}</span>
      <div className="grid min-w-0 gap-1.5">
        <p className={cn('text-[1.0625rem] font-medium', state === 'later' ? 'text-ink-2' : 'text-ink')}>
          {title}
          {state === 'done' && (
            <>
              <span aria-hidden="true" className="ml-2 text-signal">
                ✓
              </span>
              <span className="sr-only"> (done)</span>
            </>
          )}
        </p>
        <p className="max-w-[60ch] text-[0.9375rem] leading-relaxed text-ink-2">{body}</p>
        {children && <div className="mt-2 grid gap-3">{children}</div>}
      </div>
      {action && <div className="col-start-2 sm:col-start-3 sm:row-start-1 sm:justify-self-end">{action}</div>}
    </li>
  )
}
