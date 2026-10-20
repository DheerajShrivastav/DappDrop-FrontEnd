import type { Campaign } from '@/lib/types'
import { getCampaignStatus } from '@/lib/campaign-status'
import { displayImageUrl } from '@/lib/campaign-image'
import { CampaignStatusChip, CardLink, KeyValueList, payoutShortLabel, plural, shortAddress } from '@/components/app'
import { participantsFact, rewardFact, taskCheckSummary, timeFact } from '@/app/(app)/campaigns/_lib/discovery'

/**
 * The /campaigns card (app-design §1.7), typographic: the status chip + the payout label, the
 * serif title (2 lines max), "Hosted by 0x7a1c…9c03", three fact rows (reward · participants ·
 * the time row, which follows the state) and a footer line. A host-uploaded cover shows as a 16:7
 * band above the chip; with none there's no band at all (never a placeholder).
 *
 * The whole card is one link (CardLink). Status words come only from getCampaignStatus().
 * Presentational: the page owns the data (whether this wallet joined, its claimable reward).
 *
 * 08-site phase 2 replaced the old card (gradient image, translucent chips, the hover-only host
 * "End" button that fired before the end time, APP-08/10). The dashboard's host actions moved to
 * the dashboard's "Needs you" rows, which lead to the campaign page's host panels.
 */
export function CampaignCard({
  campaign,
  now,
  joined = false,
  rewardLabel,
  hasReward = false,
  headingLevel = 'h2',
}: {
  campaign: Campaign
  now?: Date
  /** This connected wallet joined the campaign. */
  joined?: boolean
  /** "250 EXAMPLE" when this wallet has a reward it can claim now (and the amount is known). */
  rewardLabel?: string
  /** This wallet has a reward it can claim now (amount known or not). */
  hasReward?: boolean
  headingLevel?: 'h2' | 'h3'
}) {
  const at = now ?? new Date()
  const status = getCampaignStatus(campaign, at)
  const payout = payoutShortLabel(campaign.settlement?.mode)
  const image = displayImageUrl(campaign.imageUrl)
  const reward = rewardFact(campaign)
  const time = timeFact(campaign, status, at)
  const checks = taskCheckSummary(campaign)
  const waitingForList = status.state === 'ended_finalizing' || status.state === 'overdue_fallback'

  return (
    <CardLink
      href={`/campaign/${campaign.id}`}
      title={campaign.title || `Campaign #${campaign.id}`}
      headingLevel={headingLevel}
      cover={image ? { src: image } : undefined}
      top={
        <>
          <CampaignStatusChip status={status} />
          {payout && <span className="ml-auto font-mono text-[0.75rem] text-ink-3">{payout}</span>}
        </>
      }
    >
      {campaign.host && (
        <p className="-mt-1 font-mono text-[0.75rem] text-ink-3" title={campaign.host}>
          Hosted by {shortAddress(campaign.host)}
        </p>
      )}
      <KeyValueList
        className="mt-2"
        items={[
          { label: reward.label, value: reward.value },
          { label: 'Participants', value: participantsFact(campaign) },
          { label: time.label, value: time.value, title: time.title },
        ]}
      />
      <p className="mt-auto flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-rule pt-3 text-[0.8125rem]">
        {joined ? (
          <span className="text-ink-2">You joined</span>
        ) : (
          <span className="text-ink-2">{campaign.tasks.length ? plural(campaign.tasks.length, 'task') : 'No tasks listed'}</span>
        )}
        {hasReward ? (
          <span className="text-signal">{rewardLabel ? `${rewardLabel} for you` : 'A reward for you'}</span>
        ) : waitingForList ? (
          <span className="text-ink-3">Waiting for the host’s list</span>
        ) : (
          checks && <span className="text-ink-3">{checks}</span>
        )}
      </p>
    </CardLink>
  )
}
