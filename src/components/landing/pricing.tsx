import { claims } from '@/config/claims'
import { network } from '@/config/landing'
import { LeadForm, type Field } from './lead-form'
import { Section } from './section'

/**
 * S1-13: #pricing and #founding (plan §2.8; TRS F69/F70; CPY deck §4.3).
 * - The chain line is "to be announced" (D10 default); no pricing-intent line (RED-25 gated).
 * - #founding renders only with foundingHosts.open (C1/D7, default off) AND a privacy notice
 *   (D11): a closed <details> on phone, open on desktop.
 */
const FOUNDING_FIELDS: Field[] = [
  { name: 'name', label: 'Your name', autoComplete: 'name', required: true },
  { name: 'project', label: 'Project name and link', autoComplete: 'organization', required: true },
  { name: 'role', label: 'Your role', autoComplete: 'organization-title', required: true },
  { name: 'handle', label: 'X or Telegram handle', autoComplete: 'nickname', required: true },
  { name: 'reward', label: 'What would you reward people for?', type: 'textarea', required: true },
  { name: 'when', label: 'When are you planning to run it?', required: true },
  {
    name: 'heard',
    label: 'How did you hear about DappDrop?',
    type: 'select',
    options: ['X / Twitter', 'A friend or another project', 'Telegram or Discord', 'Search', 'GitHub', 'Other'],
  },
]

export function Pricing() {
  const founding = claims.foundingHosts.open && claims.privacyNoticeUrl
  return (
    <Section id="pricing" track="pricing" eyebrow="06 — Beta terms" title="No platform fee during the beta.">
      <div className="mt-6 max-w-[44rem] space-y-3 text-small text-ink-2 md:text-body">
        <p>
          No platform fee while we&apos;re in beta. You pay normal network gas for your own transactions: creating, funding and
          opening a campaign.{network.testnet && ` On ${network.name}, that’s test ETH.`}
        </p>
        <p>Today: {network.name} testnet. At launch: a single EVM Layer 2, to be announced.</p>
      </div>
      {founding && (
        <details id="founding" className="lp-details lp-target mt-8 rounded-lg border border-rule bg-surface" data-open-desktop data-detail="founding">
          <summary className="flex min-h-11 items-center justify-between px-5 py-4">
            <h3 className="text-title font-semibold">Launch with us at mainnet.</h3>
            <span aria-hidden="true" className="lp-chevron text-ink-3 lg:hidden">
              ›
            </span>
          </summary>
          <div className="border-t border-rule px-5 pb-6 pt-4">
            <p className="max-w-[40rem] text-small text-ink-2">
              We&apos;re working closely with a small group of projects through the beta
              {claims.foundingHosts.cap ? ` (up to ${claims.foundingHosts.cap})` : ''}. You run a test campaign with the
              founder&apos;s help, and you&apos;re first in line when we launch on mainnet.
            </p>
            <div className="mt-5 max-w-[32rem]">
              <LeadForm
                form="founding"
                fields={FOUNDING_FIELDS}
                submitLabel="Send application"
                success="Thanks — we read every application."
                privacyUrl={claims.privacyNoticeUrl!}
                privacyLine="We use this only to reply to you."
              />
            </div>
          </div>
        </details>
      )}
    </Section>
  )
}
