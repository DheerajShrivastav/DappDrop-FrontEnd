'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Search, LayoutGrid } from 'lucide-react'
import { CampaignCard } from '@/components/campaign-card'
import { CampaignGridSkeleton } from '@/components/campaign-card-skeleton'
import { getAllCampaigns, hasParticipated } from '@/lib/web3-service'
import type { Campaign, SettlementMode } from '@/lib/types'
import { getLifecycleState } from '@/lib/campaign-lifecycle'
import { useWallet } from '@/context/wallet-provider'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

// FR-D2 discovery controls. Filtering/sorting runs client-side over indexer data so no page
// blocks on a live RPC call (NFR-4).
type SortKey = 'newest' | 'ending_soon' | 'most_participants'
type StatusFilter = 'all' | 'open' | 'claimable' | 'closed'
type RewardFilter = 'all' | 'ERC20' | 'ERC721'
type ModeFilter = 'all' | SettlementMode

export default function CampaignsPage() {
  const { role, address } = useWallet()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [participantCampaigns, setParticipantCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingParticipant, setIsLoadingParticipant] = useState(false)
  const initialLoadRef = useRef(false)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [reward, setReward] = useState<RewardFilter>('all')
  const [mode, setMode] = useState<ModeFilter>('all')

  const fetchAllCampaigns = async () => {
    setIsLoading(true)
    setCampaigns(await getAllCampaigns())
    setIsLoading(false)
  }

  const fetchParticipantCampaigns = async (allCampaigns: Campaign[]) => {
    if (role === 'participant' && address) {
      setIsLoadingParticipant(true)
      const joined: Campaign[] = []
      for (const campaign of allCampaigns) {
        if (await hasParticipated(campaign.id, address)) joined.push(campaign)
      }
      setParticipantCampaigns(joined)
      setIsLoadingParticipant(false)
    }
  }

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true
      fetchAllCampaigns()
    }
  }, [])

  useEffect(() => {
    if (role === 'participant' && address && campaigns.length > 0) {
      fetchParticipantCampaigns(campaigns)
    }
    if (role !== 'participant') setParticipantCampaigns([])
  }, [role, address, campaigns])

  const visibleCampaigns = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = new Date()
    return campaigns
      .filter((c) => {
        if (q && !`${c.title} ${c.description}`.toLowerCase().includes(q)) return false
        if (reward !== 'all' && c.reward.type !== reward) return false
        if (mode !== 'all' && (c.settlement?.mode ?? 'UNSET') !== mode) return false
        if (status !== 'all') {
          const state = getLifecycleState(c, now).state
          if (status === 'open' && state !== 'open') return false
          if (
            status === 'claimable' &&
            !['claims_open', 'allocations_published', 'closed_claimable'].includes(state)
          )
            return false
          if (status === 'closed' && !['swept', 'cancelled'].includes(state)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (sort === 'ending_soon') return a.endDate.getTime() - b.endDate.getTime()
        if (sort === 'most_participants') return b.participants - a.participants
        // newest — createdAt isn't on the client type; endDate desc is the available proxy
        return b.endDate.getTime() - a.endDate.getTime()
      })
  }, [campaigns, search, sort, status, reward, mode])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <motion.div
          className="mb-12"
          initial={fadeInUp.initial}
          animate={fadeInUp.animate}
          transition={{ duration: 0.4 }}
        >
          <h1 className="font-headline text-4xl font-bold tracking-tight mb-3">
            Explore Campaigns
          </h1>
          <p className="text-muted-foreground text-lg">
            Discover active campaigns and start earning rewards
          </p>
        </motion.div>

        {/* Participant's joined campaigns */}
        {role === 'participant' && participantCampaigns.length > 0 && (
          <section className="mb-16">
            <h2 className="font-headline text-2xl font-semibold tracking-tight mb-6">
              Your Joined Campaigns
            </h2>
            {isLoadingParticipant ? (
              <CampaignGridSkeleton count={3} />
            ) : (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {participantCampaigns.map((campaign, i) => (
                  <motion.div
                    key={campaign.id}
                    initial={fadeInUp.initial}
                    animate={fadeInUp.animate}
                    transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.04 }}
                  >
                    <CampaignCard campaign={campaign} />
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Filters / sort / search */}
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="claimable">Claimable</SelectItem>
              <SelectItem value="closed">Closed / ended</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reward} onValueChange={(v) => setReward(v as RewardFilter)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Reward" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rewards</SelectItem>
              <SelectItem value="ERC20">Token (ERC20)</SelectItem>
              <SelectItem value="ERC721">NFT</SelectItem>
            </SelectContent>
          </Select>
          <Select value={mode} onValueChange={(v) => setMode(v as ModeFilter)}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Settlement" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All settlement</SelectItem>
              <SelectItem value="MERKLE_ERC20">Token · Merkle</SelectItem>
              <SelectItem value="RANK_TIERED">Token · Rank-tiered</SelectItem>
              <SelectItem value="SCORE_TIERED">Token · Score-tiered</SelectItem>
              <SelectItem value="NFT">NFT</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="ending_soon">Ending soon</SelectItem>
              <SelectItem value="most_participants">Most participants</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <section>
          {isLoading ? (
            <CampaignGridSkeleton />
          ) : visibleCampaigns.length > 0 ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {visibleCampaigns.map((campaign, i) => (
                <motion.div
                  key={campaign.id}
                  initial={fadeInUp.initial}
                  animate={fadeInUp.animate}
                  transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.04 }}
                >
                  <CampaignCard campaign={campaign} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-card rounded-xl border border-dashed">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <LayoutGrid className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No campaigns match your filters</h3>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Try clearing the search or filters to see more.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
