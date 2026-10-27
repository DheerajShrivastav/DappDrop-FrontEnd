'use client'

import { useEffect, useState } from 'react'
import type { Campaign, Task } from '@/lib/types'
import { ROOT_DISPUTE_WINDOW_MS } from '@/lib/campaign-status'
import { Chip } from '@/components/app'
import { CampaignsView } from '../../campaigns/_components/campaigns-view'
import { DashboardView, type DashboardGate, type OverviewStats } from '../../dashboard/_components/dashboard-view'

const D = 24 * 60 * 60 * 1000
const H = 60 * 60 * 1000
const ROOT = '0x' + 'ab'.repeat(32)
const HOST = '0x51e2c0ffee000000000000000000000000c007bd'
const ME = '0x3f9c00000000000000000000000000000000a1e2'

const tasks = (checked: number, self: number): Task[] => [
  ...Array.from({ length: checked }, (_, i) => ({ id: `c${i}`, type: (i % 2 ? 'JOIN_DISCORD' : 'WALLET_CONNECT') as Task['type'], description: '' })),
  ...Array.from({ length: self }, (_, i) => ({ id: `s${i}`, type: 'SOCIAL_FOLLOW' as const, description: '' })),
]

/** Example campaigns covering the states (relative to `now`). Every title says "Example:". */
function examples(now: number): Campaign[] {
  const at = (ms: number) => new Date(now + ms)
  const base = (id: string, title: string, over: Partial<Campaign>): Campaign => ({
    id,
    title,
    description: '',
    longDescription: '',
    startDate: at(-4 * D),
    endDate: at(3 * D),
    status: 'Open',
    participants: 0,
    host: HOST,
    tasks: tasks(2, 1),
    reward: { type: 'ERC20', tokenAddress: '', name: '' },
    settlement: { mode: 'MERKLE_ERC20' },
    imageUrl: '',
    ...over,
  })
  return [
    base('101', 'Example: Validator onboarding', { participants: 38, reward: { type: 'ERC20', tokenAddress: '', name: '1,000 EXAMPLE' }, settlement: { mode: 'MERKLE_ERC20', maxParticipants: 500 } }),
    base('102', 'Example: Community week', {
      status: 'Closed',
      startDate: at(-20 * D),
      endDate: at(-12 * D),
      participants: 11,
      reward: { type: 'ERC20', tokenAddress: '', name: '2,500 EXAMPLE' },
      settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-10 * D), closedAt: at(-3 * D) },
      tasks: tasks(3, 0),
    }),
    base('103', 'Example: Docs sprint', {
      status: 'Ended',
      startDate: at(-9 * D),
      endDate: at(-2 * D),
      participants: 24,
      reward: { type: 'ERC20', tokenAddress: '', name: '600 EXAMPLE' },
      settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-(ROOT_DISPUTE_WINDOW_MS - 6 * H)) },
      tasks: tasks(2, 0),
    }),
    base('104', 'Example: Bug-bash, ranked', { endDate: at(12 * D), participants: 71, reward: { type: 'ERC20', tokenAddress: '', name: '5,000 EXAMPLE' }, settlement: { mode: 'RANK_TIERED' }, tasks: tasks(3, 1) }),
    base('105', 'Example: Genesis badge', {
      status: 'Ended',
      startDate: at(-11 * D),
      endDate: at(-4 * D),
      participants: 19,
      reward: { type: 'ERC721', tokenAddress: '', name: '40 EXAMPLE-NFT' },
      settlement: { mode: 'NFT' },
      // A data: URI cover (no network): the optional 16:7 band.
      imageUrl:
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70"><rect width="160" height="70" fill="#1c1a17"/><circle cx="80" cy="35" r="22" fill="none" stroke="#f2b45e" stroke-width="2"/><text x="80" y="38" font-family="monospace" font-size="8" fill="#f2b45e" text-anchor="middle">EXAMPLE</text></svg>',
        ),
    }),
    base('106', 'Example: Early-access list', {
      status: 'Closed',
      startDate: at(-80 * D),
      endDate: at(-70 * D),
      participants: 1,
      reward: { type: 'ERC20', tokenAddress: '', name: '800 EXAMPLE' },
      settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, closedAt: at(-60 * D), erc20Swept: true, erc20SweptAt: at(-29 * D) },
      tasks: tasks(1, 0),
    }),
  ]
}

/** The host's campaigns for the dashboard fixture (host = ME). */
function hostExamples(now: number): Campaign[] {
  const at = (ms: number) => new Date(now + ms)
  const list = examples(now)
  return [
    { ...list[4], id: '201', title: 'Example: Testnet launch quest', host: ME, settlement: { mode: 'MERKLE_ERC20' }, reward: list[0].reward, imageUrl: '', participants: 38 },
    { ...list[3], id: '202', host: ME },
    { ...list[1], id: '203', host: ME, status: 'Ended', settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-5 * D) } },
    {
      ...list[0],
      id: '204',
      title: 'Example: Docs sprint, round 2',
      host: ME,
      status: 'Draft',
      participants: 0,
      startDate: at(2 * D),
      endDate: at(9 * D),
      settlement: { mode: 'MERKLE_ERC20', erc20EscrowedNet: '600000000000000000000' },
    },
  ]
}

const tag = <Chip variant="example">Example data</Chip>

/**
 * States: campaigns → loaded (default; the wallet joined two and has a reward), anon (no wallet),
 * loading, error, empty (nothing live; the test runs hidden). dashboard → host (default), calm
 * (nothing needs the host; analytics unavailable), checking, disconnected, not-host, empty, error.
 */
export function ListFixture({ view, state }: { view: 'campaigns' | 'dashboard'; state: string }) {
  // Times are relative to now: render after mount so the server and client agree.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => setNow(Date.now()), [])
  if (now === null) return null
  const clock = new Date(now)

  if (view === 'campaigns') {
    const all = examples(now)
    const hiddenRuns = all.slice(4).map((c, i) => ({ ...c, id: `9${i}`, title: `Example: internal test run ${i + 1}` }))
    if (state === 'loading') return <CampaignsView listed={[]} hidden={[]} loading now={clock} headerTag={tag} />
    if (state === 'error')
      return <CampaignsView listed={[]} hidden={[]} loading={false} error="The campaign data could not be fetched." onRetry={() => {}} now={clock} headerTag={tag} />
    if (state === 'empty') return <CampaignsView listed={[]} hidden={hiddenRuns} loading={false} now={clock} headerTag={tag} />
    const anon = state === 'anon'
    return (
      <CampaignsView
        listed={all}
        hidden={hiddenRuns}
        loading={false}
        now={clock}
        headerTag={tag}
        joined={anon ? undefined : new Set(['102', '104'])}
        rewards={anon ? [] : [{ campaignId: '102', amountLabel: '250 EXAMPLE' }]}
      />
    )
  }

  const gates: Record<string, DashboardGate> = { checking: 'checking', disconnected: 'disconnected', 'not-host': 'not-host' }
  const gate = gates[state] ?? 'host'
  const overview: OverviewStats = state === 'calm' ? { status: 'error' } : { status: 'ok', sponsoredClaims: 7, humanityExcluded: 2 }
  const hostList = hostExamples(now)
  const campaigns = state === 'empty' || state === 'error' ? [] : state === 'calm' ? [hostList[1]] : hostList
  return (
    <DashboardView
      gate={gate}
      address={gate === 'disconnected' ? null : ME}
      onConnect={() => {}}
      campaigns={campaigns}
      loadError={state === 'error' ? 'Your campaigns could not be fetched.' : null}
      onRetry={() => {}}
      overview={overview}
      now={clock}
      headerTag={tag}
    />
  )
}
