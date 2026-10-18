'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'

import type { Campaign } from '@/lib/types'
import { displayImageUrl } from '@/lib/campaign-image'
import { getCampaignStatus } from '@/lib/campaign-status'
import { getStatusStyle } from '@/lib/status-styles'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function CampaignHero({ campaign }: { campaign: Campaign }) {
  const imageUrl = displayImageUrl(campaign.imageUrl)
  // One chip from the shared status model: the same label the card, the banner and the
  // dashboard show, so the page can't contradict itself.
  const status = getCampaignStatus(campaign)
  const statusStyle = getStatusStyle(status.state)
  return (
    <motion.div
      className="relative h-[400px] w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={campaign.title}
          fill
          className="object-cover"
          priority
          unoptimized={imageUrl.startsWith('http')}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />

      {/* Back Button */}
      <div className="absolute top-6 left-6">
        <Button
          variant="secondary"
          size="sm"
          asChild
          className="backdrop-blur-sm bg-white/90 hover:bg-white"
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      {/* Campaign Title Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-8">
        <div className="container mx-auto">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge className={cn('flex items-center gap-1 border', statusStyle.badge)}>
                <statusStyle.Icon className="h-3 w-3" />
                {status.label}
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-headline font-bold text-white mb-3">
              {campaign.title}
            </h1>
            {campaign.longDescription && (
              <p className="text-lg text-white/90 max-w-3xl">
                {campaign.longDescription}
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
