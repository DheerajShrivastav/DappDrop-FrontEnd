'use client'

import { useState, useEffect } from 'react'
import type { Campaign } from '@/lib/types'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from './ui/card'
import { Badge } from './ui/badge'
import { Users, Gift, Calendar, Rocket, XCircle, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { useWallet } from '@/context/wallet-provider'
import { useToast } from '@/hooks/use-toast'
import { Button } from './ui/button'
import { openCampaign, endCampaign, isPaused } from '@/lib/web3-service'
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
import { cn } from '@/lib/utils'

interface CampaignCardProps {
    campaign: Campaign
    onUpdate?: () => void
}

export function CampaignCard({ campaign, onUpdate }: CampaignCardProps) {
    const { address } = useWallet()
    const { toast } = useToast()
    const [isUpdating, setIsUpdating] = useState(false)
    const [isContractPaused, setIsContractPaused] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [actionToConfirm, setActionToConfirm] = useState<'open' | 'end' | null>(
        null
    )

    useEffect(() => {
        const checkPausedState = async () => {
            const paused = await isPaused()
            setIsContractPaused(paused)
        }
        checkPausedState()
    }, [])

    const isHost =
        address && address.toLowerCase() === campaign.host.toLowerCase()

    const handleAction = async () => {
        if (!actionToConfirm) return
        setIsUpdating(true)
        setIsDialogOpen(false)
        try {
            if (actionToConfirm === 'open') {
                // Check if campaign is already open
                if (campaign.status === 'Open') {
                    toast({
                        title: 'Already Open',
                        description: 'This campaign is already open.',
                    })
                    setIsUpdating(false)
                    return
                }

                // Attempt to open or create new campaign
                const resultCampaignId = await openCampaign(campaign.id, toast)

                // Only redirect if a new campaign was created (ID is different)
                if (resultCampaignId !== campaign.id) {
                    window.location.href = `/campaign/${resultCampaignId}`
                    return // Stop execution here since we're redirecting
                }
            } else if (actionToConfirm === 'end') {
                await endCampaign(campaign.id)
            }
            if (onUpdate) onUpdate()
        } catch (e) {
            // Error toast is shown in the service
        } finally {
            setIsUpdating(false)
            setActionToConfirm(null)
        }
    }

    const openConfirmationDialog = (action: 'open' | 'end') => {
        setActionToConfirm(action)
        setIsDialogOpen(true)
    }

    const getBadgeStyles = () => {
        switch (campaign.status) {
            case 'Open':
                return 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 border-green-400/50'
            case 'Draft':
                return 'bg-slate-500 hover:bg-slate-600 text-white border-slate-400/50'
            case 'Ended':
                return 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 border-red-400/50'
            default:
                return 'bg-slate-100 text-slate-800'
        }
    }

    return (
        <>
            <Card className="h-full flex flex-col overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 bg-card border-border/50 hover:border-primary/30 group">
                <Link
                    href={`/campaign/${campaign.id}`}
                    className="flex flex-col flex-grow relative"
                >
                    <CardHeader className="p-0">
                        <div className="relative h-52 w-full overflow-hidden">
                            <Image
                                src={campaign.imageUrl || '/images/campaign-placeholder.jpg'}
                                alt={campaign.title}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                data-ai-hint={campaign['data-ai-hint']}
                                unoptimized={campaign.imageUrl?.startsWith('http')}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

                            <Badge
                                className={cn(
                                    "absolute top-4 right-4 px-3 py-1 text-xs font-semibold backdrop-blur-md border",
                                    getBadgeStyles()
                                )}
                            >
                                {campaign.status === 'Open' && <span className="mr-1.5 relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                </span>}
                                {campaign.status}
                            </Badge>
                        </div>
                    </CardHeader>
                    <div className="p-6 flex flex-col flex-grow">
                        <CardTitle className="text-xl mb-3 font-bold tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                            {campaign.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 text-sm mb-6">
                            {campaign.description}
                        </CardDescription>

                        <div className="mt-auto space-y-3">
                            <div className="flex items-center text-sm text-muted-foreground bg-secondary/30 p-2 rounded-md">
                                <Gift className="h-4 w-4 mr-3 text-primary shrink-0" />
                                <span className="truncate font-medium">{campaign.reward.name}</span>
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground bg-secondary/30 p-2 rounded-md">
                                <Calendar className="h-4 w-4 mr-3 text-primary shrink-0" />
                                <span className="font-medium">Ends {format(campaign.endDate, 'MMM dd, yyyy')}</span>
                            </div>
                        </div>
                    </div>
                </Link>
                <CardFooter className="bg-secondary/10 border-t p-4 flex justify-between items-center gap-4">
                    <div className="flex items-center text-sm font-medium text-muted-foreground">
                        <Users className="h-4 w-4 mr-2 text-primary/70" />
                        <span>{campaign.participants.toLocaleString()} <span className="hidden sm:inline">participants</span></span>
                    </div>

                    {isHost && onUpdate ? (
                        <div className="flex items-center gap-2">
                            {campaign.status === 'Draft' && (
                                <Button
                                    size="sm"
                                    className="bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
                                    onClick={() => openConfirmationDialog('open')}
                                    disabled={isUpdating || isContractPaused}
                                >
                                    {isUpdating && actionToConfirm === 'open' ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Rocket className="h-4 w-4 mr-2" />
                                            Launch
                                        </>
                                    )}
                                </Button>
                            )}
                            {campaign.status === 'Open' && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => openConfirmationDialog('end')}
                                    disabled={isUpdating || isContractPaused}
                                >
                                    {isUpdating && actionToConfirm === 'end' ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <XCircle className="h-4 w-4 mr-2" />
                                            End
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                            <ArrowRight className="h-5 w-5" />
                        </div>
                    )}
                </CardFooter>
            </Card>
            <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action will update the campaign's status on the blockchain.
                            {actionToConfirm === 'open' &&
                                ' It will become visible and joinable for all participants.'}
                            {actionToConfirm === 'end' &&
                                ' Participants will no longer be able to join, but can start claiming rewards if they completed the tasks.'}
                            This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleAction}>
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}