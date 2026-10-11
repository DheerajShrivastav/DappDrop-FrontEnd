import { claims } from '@/config/claims'
import { network } from '@/config/landing'
import { ExampleCampaignCard } from './example-campaign-card'
import { Receipt } from './receipt'
import { Section } from './section'

/**
 * S1-13: #participants (plan §2.7; TRS F64–F68, RED-20). Flag paths: relayerLive adds the
 * sponsored-gas line (V11; never gated on Humanity, founder decision 2026-10-01);
 * campaignsCurated adds "Browse campaigns →". One example card on phone, three from md.
 */
export function Participants() {
  const tag = `Example · ${network.name}${network.testnet ? ' testnet' : ''}`
  return (
    <Section
      id="participants"
      track="participants"
      eyebrow="05 — For participants"
      title="Your community claims straight to their own wallet."
      dek={
        <>
          Each reward is bound to the wallet that earned it, so it can&apos;t be redirected. <Receipt id="walletBinding" />
        </>
      }
    >
      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-12">
        <ul className="space-y-2.5 text-small text-ink-2 md:text-body lg:col-span-6">
          <li>Even if someone else submits the claim, the tokens land in the participant&apos;s own wallet.</li>
          <li>You can always claim with your own wallet and gas, without our help.</li>
          {claims.relayerLive && <li>We can cover the gas for your claim, within each campaign&apos;s budget.</li>}
          <li>Clear statuses: open, ended, results being finalised, claims open at a set time, closed.</li>
          <li>
            Projects create their own campaigns, and the host publishes the reward list. DappDrop doesn&apos;t vet hosts during the
            beta. <strong className="font-semibold text-ink">Never pay to take part unless you trust the project.</strong>
          </li>
          <li>During the beta, most participants will come from your own channels. Share your campaign anywhere.</li>
          {claims.campaignsCurated && (
            <li>
              <a href="/campaigns" className="lp-link inline-flex min-h-11 items-center text-ink" data-cta="participants_browse" data-loc="participants">
                Here to earn? Browse campaigns →
              </a>
            </li>
          )}
        </ul>
        <div className="hidden gap-3 md:grid md:grid-cols-3 lg:col-span-6 lg:grid-cols-1">
          <ExampleCampaignCard state="open" tag={tag} title="Example campaign: join the launch" lines={['3 tasks · ends in 5 days', 'Reward: equal split of 1,000 EXAMPLE']} />
          <ExampleCampaignCard state="claimable" tag={tag} title="Example campaign: community week" lines={['List public since yesterday · claims open', 'Your reward: 250 EXAMPLE']} />
          <ExampleCampaignCard state="closed" tag={tag} title="Example campaign: testnet sprint" lines={['Closed · 30 days left to claim']} />
        </div>
      </div>
    </Section>
  )
}
