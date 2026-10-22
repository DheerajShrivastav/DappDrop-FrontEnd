'use client'

import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { CheckCircle2, Loader2, ShieldCheck, UserPlus, Wallet, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { becomeHost } from '@/lib/web3-service'
import { DEPLOYMENT_CHAIN } from '@/lib/deployment-chain'

type GateState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'failed'; reason: string }

/**
 * Plain-language reason for a failed host-role transaction. The service also raises a toast
 * with the mapped contract revert; this is the inline state so the gate is never a dead end.
 */
export function hostRoleFailureReason(error: unknown, gasSymbol: string): string {
  const e = error as { code?: unknown; message?: unknown; shortMessage?: unknown; info?: { error?: { code?: unknown } } }
  const code = e?.code ?? e?.info?.error?.code
  const text = `${String(e?.shortMessage ?? '')} ${String(e?.message ?? '')}`.toLowerCase()
  if (code === 'ACTION_REJECTED' || code === 4001 || text.includes('user rejected') || text.includes('user denied')) {
    return 'You cancelled the transaction in your wallet. Nothing was sent.'
  }
  if (code === 'INSUFFICIENT_FUNDS' || text.includes('insufficient funds')) {
    return `This wallet doesn't have enough ${gasSymbol} to pay the gas.`
  }
  if (text.includes('paused')) {
    return 'DappDrop is paused for maintenance. Try again later.'
  }
  return "The transaction didn't go through. The notification has the details; you can try again."
}

/**
 * /create-campaign when the wallet doesn't hold the host role yet: connect (step 1), then one
 * transaction that grants the role (step 2). Shows the pending and failed states inline.
 */
export function HostGate({
  isConnected,
  address,
  onGranted,
}: {
  isConnected: boolean
  address: string | null
  onGranted: () => Promise<void> | void
}) {
  const [state, setState] = useState<GateState>({ kind: 'idle' })
  const gas = DEPLOYMENT_CHAIN.gasSymbol

  const handleBecomeHost = async () => {
    if (!isConnected || !address) return
    setState({ kind: 'pending' })
    try {
      await becomeHost()
      await onGranted()
      setState({ kind: 'idle' })
    } catch (error) {
      setState({ kind: 'failed', reason: hostRoleFailureReason(error, gas) })
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Card className="bg-card border shadow-elevated">
        <CardHeader>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-center flex items-center justify-center gap-2">
            <UserPlus className="shrink-0" /> Become a host
          </CardTitle>
          <CardDescription className="text-center">
            Two steps before your first campaign. You only do this once per wallet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: connect */}
          <div className="rounded-lg border p-4">
            <div className="flex items-start gap-3">
              {isConnected ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-open-fg" />
              ) : (
                <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">1. Connect your wallet</p>
                {isConnected && address ? (
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{address}</p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    The wallet you connect becomes the campaign host.
                  </p>
                )}
                <div className="mt-3">
                  <ConnectButton.Custom>
                    {({ account, chain, openConnectModal, openChainModal, mounted }) => {
                      if (!mounted) return null
                      if (!account) {
                        return (
                          <Button onClick={openConnectModal}>
                            <Wallet className="mr-2 h-4 w-4" />
                            Connect wallet
                          </Button>
                        )
                      }
                      if (chain?.unsupported) {
                        return (
                          <Button variant="outline" onClick={openChainModal}>
                            Switch to {DEPLOYMENT_CHAIN.name.replace(' (testnet)', '')}
                          </Button>
                        )
                      }
                      return null
                    }}
                  </ConnectButton.Custom>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: the one-time host-role transaction */}
          <div className={`rounded-lg border p-4 ${isConnected ? '' : 'opacity-60'}`}>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">2. Get the host role</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  One transaction that adds the host role to your wallet. Anyone can do it. You pay
                  only the network gas, a little {gas}.
                  {DEPLOYMENT_CHAIN.isTestnet && <> No {gas}? Get some free from any Sepolia faucet first.</>}
                </p>
                <div className="mt-3">
                  <Button
                    size="lg"
                    onClick={handleBecomeHost}
                    disabled={!isConnected || state.kind === 'pending'}
                  >
                    {state.kind === 'pending' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    {state.kind === 'pending'
                      ? 'Waiting for your wallet…'
                      : state.kind === 'failed'
                        ? 'Try again'
                        : 'Get the host role'}
                  </Button>
                  {!isConnected && (
                    <p className="mt-2 text-xs text-muted-foreground">Connect your wallet first.</p>
                  )}
                </div>
                {state.kind === 'pending' && (
                  <p className="mt-3 text-sm text-muted-foreground" role="status">
                    Confirm the transaction in your wallet. After that it usually takes under a
                    minute to confirm on-chain; keep this page open.
                  </p>
                )}
                {state.kind === 'failed' && (
                  <Alert variant="destructive" className="mt-3">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>The host role wasn&apos;t added</AlertTitle>
                    <AlertDescription>{state.reason}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
