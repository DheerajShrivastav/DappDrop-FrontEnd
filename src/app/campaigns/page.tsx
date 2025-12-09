'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { CampaignCard } from '@/components/campaign-card'
import { getAllCampaigns, hasParticipated } from '@/lib/web3-service'
import type { Campaign } from '@/lib/types'
import { useWallet } from '@/context/wallet-provider'

export default function CampaignsPage() {
    const { role, address } = useWallet()
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [participantCampaigns, setParticipantCampaigns] = useState<Campaign[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingParticipant, setIsLoadingParticipant] = useState(false)

    const fetchAllCampaigns = async () => {
        setIsLoading(true)
        const fetchedCampaigns = await getAllCampaigns()
        setCampaigns(fetchedCampaigns)
        setIsLoading(false)
    }

    const fetchParticipantCampaigns = async (allCampaigns: Campaign[]) => {
        if (role === 'participant' && address) {
            setIsLoadingParticipant(true)
            const joinedCampaigns = []
            for (const campaign of allCampaigns) {
                const joined = await hasParticipated(campaign.id, address)
                if (joined) {
                    joinedCampaigns.push(campaign)
                }
            }
            setParticipantCampaigns(joinedCampaigns)
            setIsLoadingParticipant(false)
        }
    }

    useEffect(() => {
        fetchAllCampaigns()
    }, [])

    useEffect(() => {
        if (role === 'participant' && address && campaigns.length > 0) {
            fetchParticipantCampaigns(campaigns)
        }
        if (role !== 'participant') {
            setParticipantCampaigns([])
        }
    }, [role, address, campaigns])

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-12">
                <div className="mb-12">
                    <h1 className="text-4xl font-bold tracking-tight mb-2">
                        Explore Campaigns
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        Discover active campaigns and start earning rewards
                    </p>
                </div>

                {/* Participant's Joined Campaigns */}
                {role === 'participant' && participantCampaigns.length > 0 && (
                    <section className="mb-16">
                        <h2 className="text-2xl font-bold tracking-tight mb-6">
                            Your Joined Campaigns
                        </h2>
                        {isLoadingParticipant ? (
                            <div className="flex justify-center items-center h-32">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                                {participantCampaigns.map((campaign) => (
                                    <CampaignCard key={campaign.id} campaign={campaign} />
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* All Active Campaigns */}
                <section>
                    <h2 className="text-2xl font-bold tracking-tight mb-6">
                        Active Campaigns
                    </h2>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-16 w-16 animate-spin text-primary" />
                        </div>
                    ) : campaigns.length > 0 ? (
                        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                            {campaigns.map((campaign) => (
                                <CampaignCard key={campaign.id} campaign={campaign} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-card rounded-lg border-2 border-dashed">
                            <h3 className="text-xl font-semibold">No Active Campaigns</h3>
                            <p className="text-muted-foreground mt-2">
                                Check back later for new opportunities to engage!
                            </p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}
