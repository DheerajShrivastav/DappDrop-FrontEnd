'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useWallet } from '@/context/wallet-provider'
import { useToast } from '@/hooks/use-toast'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { flagAccountOnChain, emergencyPauseOnChain, emergencyUnpauseOnChain } from '@/lib/web3-service'

type AdminRole = 'DEFAULT_ADMIN' | 'MODERATOR' | 'EMERGENCY_ADMIN' | 'SIGNER' | 'SETTLER'
type Roles = Record<AdminRole, boolean>

const fadeInUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

function errorMessage(error: unknown): string {
  return String((error as any)?.reason ?? (error as any)?.shortMessage ?? (error as any)?.message ?? error ?? 'Something went wrong')
}

async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`)
  return body
}

export default function AdminConsolePage() {
  const { address, isConnected } = useWallet()
  const { toast } = useToast()
  const [roles, setRoles] = useState<Roles | null>(null)
  const [isLoadingRoles, setIsLoadingRoles] = useState(true)

  const loadRoles = useCallback(async () => {
    if (!isConnected) {
      setRoles(null)
      setIsLoadingRoles(false)
      return
    }
    setIsLoadingRoles(true)
    try {
      const data = await fetchJson<{ roles: Roles }>('/api/admin/whoami')
      setRoles(data.roles)
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not load admin roles', description: errorMessage(error) })
      setRoles(null)
    } finally {
      setIsLoadingRoles(false)
    }
  }, [isConnected, toast])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  if (!isConnected) {
    return (
      <div className="container mx-auto max-w-3xl py-16 text-center">
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Connect your wallet</h1>
        <p className="mt-2 text-muted-foreground">Admin console access is gated on-chain by the connected wallet&apos;s role.</p>
      </div>
    )
  }

  if (isLoadingRoles) {
    return (
      <div className="container mx-auto flex max-w-3xl items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const hasAnyRole = roles && Object.values(roles).some(Boolean)

  if (!hasAnyRole) {
    return (
      <div className="container mx-auto max-w-3xl py-16 text-center">
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-destructive" />
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">
          Wallet <span className="font-mono">{address}</span> does not hold any admin role on-chain.
        </p>
      </div>
    )
  }

  return (
    <motion.div {...fadeInUp} className="container mx-auto max-w-6xl py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin console</h1>
          <p className="text-sm text-muted-foreground">
            Connected as <span className="font-mono">{address}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {roles &&
            (Object.entries(roles) as [AdminRole, boolean][])
              .filter(([, held]) => held)
              .map(([role]) => (
                <Badge key={role} variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3 w-3" /> {role}
                </Badge>
              ))}
        </div>
      </div>

      <Tabs defaultValue={firstAvailableTab(roles)}>
        <TabsList className="flex-wrap">
          {roles?.MODERATOR && <TabsTrigger value="search">Search</TabsTrigger>}
          {roles?.DEFAULT_ADMIN && <TabsTrigger value="relayer">Relayer</TabsTrigger>}
          {roles?.DEFAULT_ADMIN && <TabsTrigger value="keeper">Keeper</TabsTrigger>}
          {(roles?.MODERATOR || roles?.EMERGENCY_ADMIN) && <TabsTrigger value="moderation">Moderation</TabsTrigger>}
          {roles?.DEFAULT_ADMIN && <TabsTrigger value="webhooks">Webhooks</TabsTrigger>}
          {roles?.DEFAULT_ADMIN && <TabsTrigger value="signer-settler">Signer/Settler</TabsTrigger>}
        </TabsList>

        {roles?.MODERATOR && (
          <TabsContent value="search" className="mt-6">
            <SearchSection />
          </TabsContent>
        )}
        {roles?.DEFAULT_ADMIN && (
          <TabsContent value="relayer" className="mt-6">
            <RelayerSection />
          </TabsContent>
        )}
        {roles?.DEFAULT_ADMIN && (
          <TabsContent value="keeper" className="mt-6">
            <KeeperSection />
          </TabsContent>
        )}
        {(roles?.MODERATOR || roles?.EMERGENCY_ADMIN) && (
          <TabsContent value="moderation" className="mt-6">
            <ModerationSection roles={roles} />
          </TabsContent>
        )}
        {roles?.DEFAULT_ADMIN && (
          <TabsContent value="webhooks" className="mt-6">
            <WebhooksSection />
          </TabsContent>
        )}
        {roles?.DEFAULT_ADMIN && (
          <TabsContent value="signer-settler" className="mt-6">
            <SignerSettlerSection />
          </TabsContent>
        )}
      </Tabs>
    </motion.div>
  )
}

function firstAvailableTab(roles: Roles | null): string {
  if (!roles) return 'search'
  if (roles.MODERATOR) return 'search'
  if (roles.DEFAULT_ADMIN) return 'relayer'
  if (roles.EMERGENCY_ADMIN) return 'moderation'
  return 'search'
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function SearchSection() {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<any>(null)

  const runSearch = useCallback(async () => {
    if (query.trim().length < 2) {
      toast({ variant: 'destructive', title: 'Query too short', description: 'Enter at least 2 characters.' })
      return
    }
    setIsSearching(true)
    try {
      const data = await fetchJson(`/api/admin/search?q=${encodeURIComponent(query.trim())}`)
      setResults(data)
    } catch (error) {
      toast({ variant: 'destructive', title: 'Search failed', description: errorMessage(error) })
    } finally {
      setIsSearching(false)
    }
  }, [query, toast])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global search</CardTitle>
        <CardDescription>Search campaigns by title/host, or look up a wallet address&apos;s activity.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Campaign title, host address, or wallet address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          />
          <Button onClick={runSearch} disabled={isSearching}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {results?.wallet && (
          <div className="rounded-md border p-4">
            <h3 className="mb-2 font-medium">Wallet activity</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Humanity verified</dt>
              <dd>{String(results.wallet.humanityVerified ?? 'unknown')}</dd>
              <dt className="text-muted-foreground">Moderation flagged</dt>
              <dd>{String(results.wallet.moderationFlagged ?? 'unknown')}</dd>
              <dt className="text-muted-foreground">Sponsored claims</dt>
              <dd>{results.wallet.sponsoredClaimCount}</dd>
              <dt className="text-muted-foreground">Allocation entries</dt>
              <dd>{results.wallet.allocationCount}</dd>
            </dl>
          </div>
        )}

        {results?.campaigns?.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Hidden</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.campaigns.map((c: any) => (
                <TableRow key={c.campaignId}>
                  <TableCell>{c.campaignId}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell className="font-mono text-xs">{c.hostAddress}</TableCell>
                  <TableCell>{String(c.isActive)}</TableCell>
                  <TableCell>{c.hiddenFromDiscovery ? <Badge variant="destructive">hidden</Badge> : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Relayer spend + kill switch
// ---------------------------------------------------------------------------

function RelayerSection() {
  const { toast } = useToast()
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchJson('/api/admin/relayer')
      setData(result)
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not load relayer data', description: errorMessage(error) })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const toggleKillSwitch = useCallback(
    async (enabled: boolean) => {
      setIsToggling(true)
      try {
        await fetchJson('/api/admin/relayer/kill-switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled, reason: enabled ? reason : undefined }),
        })
        toast({ title: enabled ? 'Kill switch enabled' : 'Kill switch resumed' })
        setReason('')
        setConfirmOpen(false)
        await load()
      } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to update kill switch', description: errorMessage(error) })
      } finally {
        setIsToggling(false)
      }
    },
    [reason, load, toast],
  )

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

  const killSwitchEnabled = Boolean(data?.killSwitch?.enabled)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Kill switch</CardTitle>
          <CardDescription>
            Same DB-backed flag the worker CLI toggles via --kill/--resume. Self-claim is unaffected either way.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant={killSwitchEnabled ? 'destructive' : 'secondary'}>
              {killSwitchEnabled ? 'DISABLED (killed)' : 'active'}
            </Badge>
            {data?.killSwitch?.reason && <span className="text-sm text-muted-foreground">{data.killSwitch.reason}</span>}
          </div>
          {!killSwitchEnabled ? (
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <div className="space-y-2">
                <Label htmlFor="kill-reason">Reason (required to enable)</Label>
                <Textarea id="kill-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you disabling the relayer?" />
                <Button variant="destructive" disabled={!reason.trim()} onClick={() => setConfirmOpen(true)}>
                  Enable kill switch
                </Button>
              </div>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disable the sponsored-claim relayer?</AlertDialogTitle>
                  <AlertDialogDescription>
                    No new sponsored (gasless) claims will be processed until this is resumed. Reason: &ldquo;{reason}&rdquo;
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isToggling}>Cancel</AlertDialogCancel>
                  <AlertDialogAction disabled={isToggling} onClick={() => toggleKillSwitch(true)}>
                    {isToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button onClick={() => toggleKillSwitch(false)} disabled={isToggling}>
              {isToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resume relayer'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaign sponsorship budgets</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.campaignBudgets?.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell>{b.campaignId}</TableCell>
                  <TableCell>{new Date(b.updatedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sponsored claims</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.recentClaims?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{c.campaignId}</TableCell>
                  <TableCell className="font-mono text-xs">{c.account}</TableCell>
                  <TableCell>{c.kind}</TableCell>
                  <TableCell>{c.status}</TableCell>
                  <TableCell>{new Date(c.requestedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Keeper health
// ---------------------------------------------------------------------------

function KeeperSection() {
  const { toast } = useToast()
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setIsLoading(true)
      try {
        setData(await fetchJson('/api/admin/keeper'))
      } catch (error) {
        toast({ variant: 'destructive', title: 'Could not load keeper health', description: errorMessage(error) })
      } finally {
        setIsLoading(false)
      }
    })()
  }, [toast])

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Endable campaigns</CardTitle>
          <CardDescription>Overdue alert threshold: {data?.overdueAlertMinutes} minutes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>End date</TableHead>
                <TableHead>Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.endable?.map((c: any) => (
                <TableRow key={c.id ?? c.campaignId}>
                  <TableCell>{c.campaignId ?? c.id}</TableCell>
                  <TableCell>{new Date(c.endDate).toLocaleString()}</TableCell>
                  <TableCell>
                    {c.alert ? (
                      <Badge variant="destructive">{Math.round(c.overdueMinutes)}m overdue</Badge>
                    ) : (
                      `${Math.round(c.overdueMinutes)}m`
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data?.endable?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Nothing currently endable.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sweep runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Ended / Failed / Alerts</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.recentRuns?.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.startedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {r.endedCount} / {r.failedCount} / {r.alertCount}
                  </TableCell>
                  <TableCell className="text-destructive">{r.error ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Moderation: flag account, hide-from-discovery, emergency pause
// ---------------------------------------------------------------------------

function ModerationSection({ roles }: { roles: Roles | null }) {
  const { toast } = useToast()
  const [flagAddress, setFlagAddress] = useState('')
  const [flagScore, setFlagScore] = useState('100')
  const [flagReason, setFlagReason] = useState('')
  const [isFlagging, setIsFlagging] = useState(false)

  const [hideCampaignId, setHideCampaignId] = useState('')
  const [hideReason, setHideReason] = useState('')
  const [isHiding, setIsHiding] = useState(false)

  const [flagEvents, setFlagEvents] = useState<any[]>([])
  const [isPauseConfirmOpen, setIsPauseConfirmOpen] = useState(false)
  const [pauseAction, setPauseAction] = useState<'pause' | 'unpause' | null>(null)
  const [isPausing, setIsPausing] = useState(false)

  const loadFlags = useCallback(async () => {
    try {
      const data = await fetchJson('/api/admin/moderation/flags')
      setFlagEvents(data.events ?? [])
    } catch {
      // non-fatal for the rest of the section
    }
  }, [])

  useEffect(() => {
    if (roles?.MODERATOR) loadFlags()
  }, [roles, loadFlags])

  const submitFlag = useCallback(async () => {
    setIsFlagging(true)
    try {
      const score = Number(flagScore)
      const txHash = await flagAccountOnChain(flagAddress, score)
      await fetchJson('/api/admin/moderation/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: flagAddress, reason: flagReason, txHash }),
      })
      toast({ title: 'Account flagged on-chain', description: `Tx: ${txHash}` })
      setFlagAddress('')
      setFlagReason('')
      loadFlags()
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to flag account', description: errorMessage(error) })
    } finally {
      setIsFlagging(false)
    }
  }, [flagAddress, flagScore, flagReason, toast, loadFlags])

  const submitHide = useCallback(
    async (hidden: boolean) => {
      setIsHiding(true)
      try {
        await fetchJson('/api/admin/moderation/hide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId: Number(hideCampaignId), hidden, reason: hideReason }),
        })
        toast({ title: hidden ? 'Campaign hidden from discovery' : 'Campaign unhidden' })
      } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to update visibility', description: errorMessage(error) })
      } finally {
        setIsHiding(false)
      }
    },
    [hideCampaignId, hideReason, toast],
  )

  const confirmPause = useCallback(async () => {
    if (!pauseAction) return
    setIsPausing(true)
    try {
      const txHash = pauseAction === 'pause' ? await emergencyPauseOnChain() : await emergencyUnpauseOnChain()
      toast({ title: pauseAction === 'pause' ? 'Platform paused' : 'Platform unpaused', description: `Tx: ${txHash}` })
      setIsPauseConfirmOpen(false)
      setPauseAction(null)
    } catch (error) {
      toast({ variant: 'destructive', title: 'Emergency action failed', description: errorMessage(error) })
    } finally {
      setIsPausing(false)
    }
  }, [pauseAction, toast])

  return (
    <div className="space-y-6">
      {roles?.MODERATOR && (
        <Card>
          <CardHeader>
            <CardTitle>Flag account</CardTitle>
            <CardDescription>
              Signs flagAccount() with YOUR connected wallet (MODERATOR_ROLE, on-chain). Score 100 blocks the account from
              completing tasks entirely.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="0x... user address" value={flagAddress} onChange={(e) => setFlagAddress(e.target.value)} />
            <Input placeholder="Score (0-100, 0 clears)" value={flagScore} onChange={(e) => setFlagScore(e.target.value)} />
            <Textarea placeholder="Reason (logged off-chain)" value={flagReason} onChange={(e) => setFlagReason(e.target.value)} />
            <Button onClick={submitFlag} disabled={isFlagging || !flagAddress}>
              {isFlagging ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign & flag'}
            </Button>
          </CardContent>
        </Card>
      )}

      {roles?.MODERATOR && (
        <Card>
          <CardHeader>
            <CardTitle>Hide campaign from discovery</CardTitle>
            <CardDescription>
              Off-chain only — does NOT affect escrow, tasks, or claims. Participants can still complete tasks and claim by
              direct link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Campaign ID" value={hideCampaignId} onChange={(e) => setHideCampaignId(e.target.value)} />
            <Textarea placeholder="Reason (required to hide)" value={hideReason} onChange={(e) => setHideReason(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => submitHide(true)} disabled={isHiding || !hideCampaignId || !hideReason.trim()}>
                Hide
              </Button>
              <Button variant="outline" onClick={() => submitHide(false)} disabled={isHiding || !hideCampaignId}>
                Unhide
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {roles?.MODERATOR && flagEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent flag history</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Moderator</TableHead>
                  <TableHead>Block</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flagEvents.map((e, i) => (
                  <TableRow key={`${e.blockNumber}-${i}`}>
                    <TableCell className="font-mono text-xs">{e.user}</TableCell>
                    <TableCell>{e.score}</TableCell>
                    <TableCell className="font-mono text-xs">{e.moderator}</TableCell>
                    <TableCell>{e.blockNumber}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {roles?.EMERGENCY_ADMIN && (
        <Card>
          <CardHeader>
            <CardTitle>Emergency pause</CardTitle>
            <CardDescription>Pauses ALL state-changing entrypoints platform-wide. Signs with YOUR connected wallet.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <AlertDialog open={isPauseConfirmOpen} onOpenChange={setIsPauseConfirmOpen}>
              <Button
                variant="destructive"
                onClick={() => {
                  setPauseAction('pause')
                  setIsPauseConfirmOpen(true)
                }}
              >
                Pause platform
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPauseAction('unpause')
                  setIsPauseConfirmOpen(true)
                }}
              >
                Unpause platform
              </Button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{pauseAction === 'pause' ? 'Pause the entire platform?' : 'Lift the platform-wide pause?'}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {pauseAction === 'pause'
                      ? 'This blocks all state-changing entrypoints for every campaign until unpaused. This is a significant, immediately visible action.'
                      : 'This restores normal operation for every campaign.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPausing}>Cancel</AlertDialogCancel>
                  <AlertDialogAction disabled={isPausing} onClick={confirmPause}>
                    {isPausing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Webhook endpoint management
// ---------------------------------------------------------------------------

function WebhooksSection() {
  const { toast } = useToast()
  const [endpoints, setEndpoints] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hostAddress, setHostAddress] = useState('')
  const [url, setUrl] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchJson('/api/admin/webhooks')
      setEndpoints(data.endpoints ?? [])
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not load webhook endpoints', description: errorMessage(error) })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const create = useCallback(async () => {
    setIsCreating(true)
    try {
      const data = await fetchJson('/api/admin/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostAddress, url }),
      })
      setRevealedSecret(data.secret)
      setHostAddress('')
      setUrl('')
      await load()
    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to create endpoint', description: errorMessage(error) })
    } finally {
      setIsCreating(false)
    }
  }, [hostAddress, url, toast, load])

  const rotate = useCallback(
    async (id: string) => {
      try {
        const data = await fetchJson(`/api/admin/webhooks/${id}/rotate`, { method: 'POST' })
        setRevealedSecret(data.secret)
        await load()
      } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to rotate secret', description: errorMessage(error) })
      }
    },
    [toast, load],
  )

  const deactivate = useCallback(
    async (id: string) => {
      try {
        await fetchJson(`/api/admin/webhooks/${id}/deactivate`, { method: 'POST' })
        toast({ title: 'Endpoint deactivated' })
        await load()
      } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to deactivate endpoint', description: errorMessage(error) })
      }
    },
    [toast, load],
  )

  return (
    <div className="space-y-6">
      {revealedSecret && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>New secret — copy it now</CardTitle>
            <CardDescription>This is shown once and never again. It is not recoverable after you leave this page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <code className="block break-all rounded bg-muted p-3 text-sm">{revealedSecret}</code>
            <Button variant="outline" onClick={() => setRevealedSecret(null)}>
              I&apos;ve copied it
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create webhook endpoint</CardTitle>
          <CardDescription>
            Admin-managed on behalf of hosts — there is no host self-service screen for this yet. A future host-facing
            screen would reuse the same underlying data model, scoped to that host.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Host wallet address (0x...)" value={hostAddress} onChange={(e) => setHostAddress(e.target.value)} />
          <Input placeholder="https://host-endpoint.example.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button onClick={create} disabled={isCreating || !hostAddress || !url}>
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Host</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((ep) => (
                  <TableRow key={ep.id}>
                    <TableCell className="font-mono text-xs">{ep.hostAddress}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs">{ep.url}</TableCell>
                    <TableCell>{ep.active ? <Badge variant="secondary">active</Badge> : <Badge variant="outline">inactive</Badge>}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => rotate(ep.id)}>
                        Rotate secret
                      </Button>
                      {ep.active && (
                        <Button size="sm" variant="destructive" onClick={() => deactivate(ep.id)}>
                          Deactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Signer / settler health
// ---------------------------------------------------------------------------

function SignerSettlerSection() {
  const { toast } = useToast()
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setIsLoading(true)
      try {
        setData(await fetchJson('/api/admin/signer-settler'))
      } catch (error) {
        toast({ variant: 'destructive', title: 'Could not load signer/settler health', description: errorMessage(error) })
      } finally {
        setIsLoading(false)
      }
    })()
  }, [toast])

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Role health</CardTitle>
          <CardDescription>
            Visibility only — rotation is a deploy-time/CLI action. Plain AccessControl has no on-chain way to enumerate
            all role holders, so this shows the connected wallet&apos;s own role membership plus activity trails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Connected wallet holds SIGNER_ROLE: <strong>{String(data?.connectedWallet?.isSigner)}</strong></div>
          <div>Connected wallet holds SETTLER_ROLE: <strong>{String(data?.connectedWallet?.isSettler)}</strong></div>
          <div>Last signed at: <strong>{data?.lastSignedAt ? new Date(data.lastSignedAt).toLocaleString() : 'never'}</strong></div>
          <div>Last fallback action: <strong>{data?.lastFallbackAction ? `${data.lastFallbackAction.kind} (campaign ${data.lastFallbackAction.campaignId}, block ${data.lastFallbackAction.blockNumber})` : 'none'}</strong></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent SETTLER_ROLE activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Settler</TableHead>
                <TableHead>Block</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.recentSettlerActivity?.map((e: any, i: number) => (
                <TableRow key={`${e.blockNumber}-${i}`}>
                  <TableCell>{e.campaignId}</TableCell>
                  <TableCell>{e.kind}</TableCell>
                  <TableCell className="font-mono text-xs">{e.settler}</TableCell>
                  <TableCell>{e.blockNumber}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
