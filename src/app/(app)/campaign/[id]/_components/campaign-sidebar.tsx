'use client'

import { format } from 'date-fns'
import { motion } from 'framer-motion'
import {
  Calendar,
  Gift,
  Users,
  Share2,
  RefreshCw,
  Loader2,
  Rocket,
  XCircle,
  Info,
  AlertTriangle,
} from 'lucide-react'

import type { Campaign } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface CampaignSidebarProps {
  campaign: Campaign
  participantCount: number
  isHostOfCampaign: boolean
  isRefreshing: boolean
  isUpdatingCampaign: boolean
  isTimeExpiredNotClosed?: boolean
  campaignActionToConfirm: 'launch' | 'end' | null
  onShare: () => void
  onRefresh: () => void
  onCampaignAction: (action: 'launch' | 'end') => void
}

export function CampaignSidebar({
  campaign,
  participantCount,
  isHostOfCampaign,
  isRefreshing,
  isUpdatingCampaign,
  isTimeExpiredNotClosed,
  campaignActionToConfirm,
  onShare,
  onRefresh,
  onCampaignAction,
}: CampaignSidebarProps) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.6 }}
    >
      <Card className="card-modern sticky top-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-headline">Campaign Info</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Expired-but-not-closed warning */}
          {isTimeExpiredNotClosed && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-800 leading-relaxed">
                End time has passed but this campaign is not yet closed on-chain.
                {isHostOfCampaign
                  ? ' Please end the campaign below so participants can claim rewards.'
                  : ' Avoid interacting until the creator closes it.'}
              </p>
            </div>
          )}

          {/* About This Campaign */}
          {campaign.description && !campaign.description.startsWith('A campaign hosted by') && (
            <div className="p-3 bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-lg border border-slate-200/60">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-primary/70" />
                <p className="text-xs font-semibold uppercase tracking-wider text-primary/70">About</p>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {campaign.description}
              </p>
            </div>
          )}
          {/* Participants */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Participants</p>
              <p className="text-2xl font-bold">{participantCount}</p>
            </div>
          </div>

          {/* End Date */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Ends On</p>
              <p className="font-semibold">
                {format(new Date(campaign.endDate), 'MMM dd, yyyy')}
              </p>
            </div>
          </div>

          {/* Reward */}
          <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
            <Gift className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Reward</p>
              <p className="font-semibold">{campaign.reward.name}</p>
            </div>
          </div>

          {/* Share Button */}
          <Button variant="outline" className="w-full" onClick={onShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share Campaign
          </Button>

          {/* Host Controls */}
          {isHostOfCampaign && (
            <div className="pt-4 border-t space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Host Controls
              </p>
              {campaign.status === 'Draft' && (
                <Button
                  className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
                  onClick={() => onCampaignAction('launch')}
                  disabled={isUpdatingCampaign}
                >
                  {isUpdatingCampaign && campaignActionToConfirm === 'launch' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4 mr-2" />
                  )}
                  Launch Campaign
                </Button>
              )}
              {campaign.status === 'Open' && (
                <Button
                  variant="destructive"
                  className={`w-full ${isTimeExpiredNotClosed ? 'animate-pulse' : ''}`}
                  onClick={() => onCampaignAction('end')}
                  disabled={isUpdatingCampaign}
                >
                  {isUpdatingCampaign && campaignActionToConfirm === 'end' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  {isTimeExpiredNotClosed ? 'End Campaign (Required)' : 'End Campaign'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
