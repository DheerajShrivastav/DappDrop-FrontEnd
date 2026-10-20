'use client'

/**
 * Dev-only fixtures for the campaign page (see page.tsx). EVERY value here is example data: the
 * campaign, the wallets, the list and the reports are invented, and the page shows an "Example"
 * chip. Wallet-only states (connected, host, claimable…) can't be captured on the live page
 * without a wallet, so this renders <CampaignView/> with a pretend wallet and answers the page's
 * own API calls for the example campaign (#9000) from memory.
 */
import { useEffect, useState, type ReactNode } from 'react'
import type { Campaign, UserTask } from '@/lib/types'
import { getCampaignStatus } from '@/lib/campaign-status'
import type { SponsoredClaimState } from '@/hooks/use-sponsored-claim'
import { ClaimActions, ExampleChip } from '@/components/app'
import { CampaignView } from '../../campaign/[id]/_components/campaign-view'
import { RewardPanel, reviewReason, type RewardViewState } from '../../campaign/[id]/_components/reward-panel'
import { deadlineLine } from '../../campaign/[id]/_components/claim-section'

const H = 60 * 60 * 1000
const D = 24 * H
const now = Date.now()
const at = (ms: number) => new Date(now + ms)
const ID = '9000'
const HOST = '0x51e2000000000000000000000000000000007bd0'
const ME = '0x3f9c00000000000000000000000000000000a1e2'
const ROOT = '0x' + 'ab'.repeat(32)
const ZERO = '0x' + '00'.repeat(32)
const WEI = '000000000000000000'
const wallet = (i: number) => '0x' + (i + 10).toString(16).padStart(4, '0') + '0'.repeat(32) + 'c0de'

const TASKS: Campaign['tasks'] = [
  { id: 't1', type: 'JOIN_DISCORD', description: 'Join the Example Discord server' },
  { id: 't2', type: 'WALLET_CONNECT', description: 'Sign in with your wallet' },
  { id: 't3', type: 'SOCIAL_FOLLOW', description: 'Follow @example on X' },
]
const TASKS_5: Campaign['tasks'] = [
  ...TASKS,
  { id: 't4', type: 'HUMANITY_VERIFICATION', description: 'Confirm you’re a real person' },
  { id: 't5', type: 'JOIN_TELEGRAM', description: 'Join the Example Telegram group', isOptional: true },
]

function campaign(over: Partial<Campaign> & { settlement?: Campaign['settlement'] }): Campaign {
  return {
    id: ID,
    title: 'Example: Community week',
    description: 'Join the Example community, introduce yourself, and help us test the claim flow before launch.',
    longDescription: '',
    startDate: at(-9 * D),
    endDate: at(-2 * D),
    status: 'Ended',
    participants: 11,
    host: HOST,
    tasks: TASKS,
    reward: { type: 'ERC20', tokenAddress: '0x' + '1'.repeat(40), name: '2,500 EXAMPLE' },
    imageUrl: '',
    ...over,
  }
}

const merkle = (extra: Partial<NonNullable<Campaign['settlement']>> = {}): Campaign['settlement'] => ({ mode: 'MERKLE_ERC20', maxParticipants: 500, ...extra })
const OPEN = { status: 'Open' as const, startDate: at(-2 * D), endDate: at(3 * D) }
const FINALIZING = merkle({ erc20MerkleRoot: ZERO })
const REVIEW = merkle({ erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-18 * H) })
const CLAIMS = merkle({ erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-3 * D) })
const CLOSED = merkle({ erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-6 * D), closedAt: at(-2 * D) })
const SWEPT = merkle({ erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-40 * D), closedAt: at(-35 * D), erc20Swept: true, erc20SweptAt: at(-4 * D) })

const done = (ids: string[], extra: Partial<Record<string, Partial<UserTask>>> = {}): UserTask[] =>
  TASKS_5.map((t) => ({ taskId: t.id, completed: ids.includes(t.id), ...extra[t.id] }))

// ---------------------------------------------------------------------------------------------
// The example API (only for campaign #9000)
// ---------------------------------------------------------------------------------------------
type Api = { list?: 'proposed' | 'published'; reports?: boolean; nft?: boolean }
let API: Api = {}

const entries = Array.from({ length: 10 }, (_, i) => ({ wallet: i === 0 ? ME : wallet(i), amount: `250${WEI}`, tasksCompleted: 3 }))
function allocation(status: 'PROPOSED' | 'PUBLISHED') {
  return {
    version: status === 'PUBLISHED' ? 1 : 2,
    root: ROOT,
    token: '0x' + '1'.repeat(40),
    decimals: 18,
    symbol: 'EXAMPLE',
    totalAmount: `2500${WEI}`,
    policy: 'equal split',
    status,
    createdAt: at(-1 * D).toISOString(),
    publishedAt: status === 'PUBLISHED' ? at(-18 * H).toISOString() : null,
    excludedForHumanity: [wallet(42)],
    entries,
  }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function answer(path: string): Response | null {
  if (!path.startsWith(`/api/campaigns/${ID}/`)) return null
  const rest = path.slice(`/api/campaigns/${ID}/`.length)
  if (rest.startsWith('allocations/latest'))
    return API.list && !API.nft ? json({ allocation: allocation(API.list === 'published' ? 'PUBLISHED' : 'PROPOSED'), livePublishedVersion: API.list === 'published' ? 1 : null }) : json({ allocation: null })
  if (rest.startsWith('nft-allocations/latest')) return json({ allocation: null })
  if (rest.startsWith('reports'))
    return json({
      merkleRoot: ROOT,
      priorRootReports: [],
      reports: API.reports
        ? [
            {
              id: 'r1',
              reporterWallet: wallet(42),
              merkleRoot: ROOT,
              category: 'missing_allocation',
              reason: 'I finished every task on 5 Oct but I’m not on the list. (Example report.)',
              status: 'OPEN',
              hostResponse: null,
              createdAt: at(-6 * H).toISOString(),
              reviewedAt: null,
              allocation: null,
            },
          ]
        : [],
    })
  if (rest.startsWith('analytics'))
    return json({ funnel: { joined: 38, tasksStarted: 36, qualified: 31, claimed: API.list === 'published' ? 4 : 0 }, taskStats: [], humanityGated: false, humanityExcluded: 0, claimSplit: { sponsored: 0, self: 0 }, claimsOverTime: [] })
  return json({ error: 'Example API: not mocked' }, 404)
}

function installExampleApi() {
  const w = window as unknown as { __ddFixtureFetch?: boolean }
  if (w.__ddFixtureFetch) return
  w.__ddFixtureFetch = true
  const real = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const path = url.startsWith('http') ? new URL(url).pathname : url
    return answer(path) ?? real(input, init)
  }
}

// ---------------------------------------------------------------------------------------------
// The states
// ---------------------------------------------------------------------------------------------
type Fixture = {
  label: string
  campaign: Campaign
  connected?: boolean
  host?: boolean
  joined?: boolean
  userTasks?: UserTask[]
  taskErrors?: Record<string, string>
  api?: Api
  claim?: (c: Campaign) => ReactNode
}

const AMOUNT = { value: '250', unit: 'EXAMPLE' }
function claimPanel(view: RewardViewState, sponsored?: SponsoredClaimState, opts: { walletError?: string; nft?: boolean; rankLine?: string } = {}) {
  return function ClaimFixture(c: Campaign) {
    const status = getCampaignStatus(c)
    const label = opts.nft ? 'ERC721 #12' : '250 EXAMPLE'
    const actions =
      view.kind === 'claimable' || view.kind === 'review' ? (
        <ClaimActions
          amountLabel={label}
          sponsored={sponsored}
          onSponsoredClaim={() => {}}
          onRetrySponsored={() => {}}
          onWalletClaim={() => {}}
          walletError={opts.walletError}
          disabledReason={view.kind === 'review' ? reviewReason(view.claimsOpenAt) : undefined}
        />
      ) : undefined
    return (
      <RewardPanel
        view={view}
        address={ME}
        nft={opts.nft}
        rankLine={opts.rankLine}
        actions={actions}
        deadline={deadlineLine(status)}
        report={<a className="dd-link" href="#cp-list">Report a concern</a>}
        onConnect={() => {}}
        onRetry={() => {}}
      />
    )
  }
}

const FIXTURES: Record<string, Fixture> = {
  'p-open-visitor': { label: 'Participant · open · not connected', campaign: campaign({ ...OPEN, settlement: merkle() }) },
  'p-open-tasks': {
    label: 'Participant · open · every task-row state',
    campaign: campaign({ ...OPEN, tasks: TASKS_5, settlement: merkle() }),
    connected: true,
    joined: true,
    userTasks: done(['t1', 't3'], { t2: { isCompleting: true } }),
    taskErrors: { t4: 'this wallet isn’t verified as human yet.' },
  },
  'p-full': { label: 'Participant · open · campaign full', campaign: campaign({ ...OPEN, participants: 500, settlement: merkle() }), connected: true },
  'p-record-end': { label: 'Participant · end time passed, not recorded', campaign: campaign({ status: 'Open', settlement: merkle() }), connected: true, joined: true, userTasks: done(['t1', 't2', 't3']) },
  'p-waiting': { label: 'Participant · ended, list next', campaign: campaign({ settlement: FINALIZING }), connected: true, joined: true, userTasks: done(['t1', 't2', 't3']) },
  'p-review': {
    label: 'Participant · list public, 24 h review',
    campaign: campaign({ settlement: REVIEW }),
    connected: true,
    joined: true,
    userTasks: done(['t1', 't2', 't3']),
    api: { list: 'published' },
    claim: claimPanel({ kind: 'review', amount: AMOUNT, claimsOpenAt: at(6 * H) }),
  },
  'p-claimable': {
    label: 'Participant · claimable (gas-free first)',
    campaign: campaign({ settlement: CLAIMS }),
    connected: true,
    joined: true,
    userTasks: done(['t1', 't2', 't3']),
    api: { list: 'published' },
    claim: claimPanel({ kind: 'claimable', amount: AMOUNT }, { phase: 'idle' }),
  },
  'p-claim-processing': {
    label: 'Participant · gas-free claim in progress',
    campaign: campaign({ settlement: CLAIMS }),
    connected: true,
    joined: true,
    userTasks: done(['t1', 't2', 't3']),
    api: { list: 'published' },
    claim: claimPanel({ kind: 'claimable', amount: AMOUNT }, { phase: 'processing', status: 'PENDING' }),
  },
  'p-claim-fallback': {
    label: 'Participant · gas-free unavailable → wallet claim',
    campaign: campaign({ settlement: CLAIMS }),
    connected: true,
    joined: true,
    userTasks: done(['t1', 't2', 't3']),
    api: { list: 'published' },
    claim: claimPanel({ kind: 'claimable', amount: AMOUNT }, { phase: 'unavailable', reason: 'Today’s gas budget is used up' }, { walletError: 'You cancelled in your wallet.' }),
  },
  'p-claim-by': {
    label: 'Participant · closed, claim by',
    campaign: campaign({ status: 'Closed', settlement: CLOSED }),
    connected: true,
    joined: true,
    userTasks: done(['t1', 't2', 't3']),
    api: { list: 'published' },
    claim: claimPanel({ kind: 'claimable', amount: AMOUNT }, { phase: 'idle' }),
  },
  'p-claimed': {
    label: 'Participant · claimed',
    campaign: campaign({ settlement: CLAIMS }),
    connected: true,
    joined: true,
    userTasks: done(['t1', 't2', 't3']),
    api: { list: 'published' },
    claim: claimPanel({ kind: 'claimed', amount: AMOUNT, txHash: '0x' + 'cd'.repeat(32) }),
  },
  'p-not-on-list': { label: 'Participant · not on the list', campaign: campaign({ settlement: CLAIMS }), connected: true, api: { list: 'published' }, claim: claimPanel({ kind: 'not-on-list' }) },
  'p-swept': { label: 'Participant · swept', campaign: campaign({ status: 'Closed', settlement: SWEPT }), connected: true, joined: true, api: { list: 'published' }, claim: claimPanel({ kind: 'swept', endedOn: at(-4 * D) }) },
  'p-claim-visitor': { label: 'Participant · claims open · not connected', campaign: campaign({ settlement: CLAIMS }), api: { list: 'published' } },
  'p-nft': {
    label: 'Participant · NFT, claimable',
    campaign: campaign({ settlement: { mode: 'NFT', nftMerkleRoot: ROOT, nftRootPublishedAt: at(-3 * D) }, reward: { type: 'ERC721', tokenAddress: '0x' + '2'.repeat(40), name: 'Example badge' } }),
    connected: true,
    joined: true,
    api: { nft: true },
    claim: claimPanel({ kind: 'claimable', amount: { value: '#12', unit: 'ERC721' } }, { phase: 'idle' }, { nft: true }),
  },
  'p-tiered': {
    label: 'Participant · ranked, claimable',
    campaign: campaign({ settlement: { mode: 'RANK_TIERED' } }),
    connected: true,
    joined: true,
    claim: claimPanel({ kind: 'claimable', amount: { value: '100', unit: 'EXAMPLE' } }, { phase: 'idle' }, { rankLine: 'Completion rank #3' }),
  },
  'p-tiered-no-rank': {
    label: 'Participant · ranked, not eligible',
    campaign: campaign({ settlement: { mode: 'SCORE_TIERED' } }),
    connected: true,
    joined: true,
    claim: claimPanel({ kind: 'not-eligible', message: 'Your score doesn’t reach a reward tier.' }, undefined, { rankLine: 'Score: 20 points' }),
  },
  'h-draft': { label: 'Host · draft', campaign: campaign({ status: 'Draft', startDate: at(1 * D), endDate: at(8 * D), participants: 0, settlement: merkle() }), connected: true, host: true },
  'h-open': { label: 'Host · open', campaign: campaign({ ...OPEN, participants: 38, settlement: merkle() }), connected: true, host: true },
  'h-record-end': { label: 'Host · end time passed', campaign: campaign({ status: 'Open', participants: 38, settlement: merkle() }), connected: true, host: true },
  'h-publish': {
    label: 'Host · publish the list (close guarded)',
    campaign: campaign({ participants: 38, settlement: FINALIZING }),
    connected: true,
    host: true,
    api: { list: 'proposed' },
  },
  'h-review': { label: 'Host · 24 h review with a report', campaign: campaign({ participants: 38, settlement: REVIEW }), connected: true, host: true, api: { list: 'published', reports: true } },
  'h-close': { label: 'Host · claims open, close next', campaign: campaign({ participants: 38, settlement: CLAIMS }), connected: true, host: true, api: { list: 'published' } },
  'h-closed': { label: 'Host · closed, 30 days', campaign: campaign({ status: 'Closed', participants: 38, settlement: CLOSED }), connected: true, host: true, api: { list: 'published' } },
  'h-swept': { label: 'Host · swept', campaign: campaign({ status: 'Closed', participants: 38, settlement: SWEPT }), connected: true, host: true, api: { list: 'published' } },
}

export function CampaignFixtures() {
  const [key, setKey] = useState<string | null>(null)
  useEffect(() => {
    installExampleApi()
    const k = new URLSearchParams(window.location.search).get('state') ?? 'p-claimable'
    const f = FIXTURES[k] ?? FIXTURES['p-claimable']
    API = f.api ?? {}
    setKey(FIXTURES[k] ? k : 'p-claimable')
  }, [])

  if (!key) return <h1 className="sr-only">Campaign fixtures</h1>
  const f = FIXTURES[key]
  const userTasks = f.userTasks ? f.userTasks.filter((u) => f.campaign.tasks.some((t) => t.id === u.taskId)) : f.campaign.tasks.map((t) => ({ taskId: t.id, completed: false }))

  return (
    <>
      <nav aria-label="Fixture states" className="lp-container pt-4">
        <p className="font-mono text-[0.75rem] text-ink-2">
          Dev fixture · example data · <span className="text-ink">{f.label}</span> ·{' '}
          <label>
            <span className="sr-only">Choose a state</span>
            <select
              className="border-b border-rule-strong bg-transparent text-ink"
              value={key}
              onChange={(e) => (window.location.search = `?state=${e.target.value}`)}
            >
              {Object.entries(FIXTURES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </p>
      </nav>
      <CampaignView
        campaign={f.campaign}
        address={f.connected ? (f.host ? HOST : ME) : null}
        isConnected={!!f.connected}
        isHost={!!f.host}
        userTasks={userTasks}
        taskErrors={f.taskErrors ?? {}}
        isJoined={!!f.joined}
        onConnect={() => {}}
        onStartTask={() => {}}
        onRecordEnd={() => {}}
        isRecordingEnd={false}
        onCopyLink={() => {}}
        onRefresh={() => {}}
        isRefreshing={false}
        onStatusChange={() => {}}
        extraChips={<ExampleChip />}
        claimOverride={f.claim?.(f.campaign)}
      />
    </>
  )
}
