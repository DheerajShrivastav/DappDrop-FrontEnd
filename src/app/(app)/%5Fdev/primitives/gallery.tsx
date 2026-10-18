'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getCampaignStatus, type CampaignStatusInput } from '@/lib/campaign-status'
import { defaultScheduleState, type ScheduleState } from '@/lib/campaign-schedule'
import {
  Button,
  CampaignStatusChip,
  CardLink,
  CardSkeleton,
  CharCount,
  Chip,
  ClaimActions,
  ClaimSkeleton,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  ErrorSummary,
  ExampleChip,
  Field,
  Input,
  KeyValueList,
  LoadingRegion,
  LockedField,
  NativeSelect,
  PageHeader,
  Panel,
  PayoutChip,
  RowsSkeleton,
  ScheduleField,
  SectionHeader,
  Segmented,
  StatRow,
  Textarea,
  VerificationChip,
  WizardStepper,
  controlClass,
  stepEyebrow,
  toast,
} from '@/components/app'

// Sample data only (every value is an example; nothing here is read from the chain).
const D = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-16T12:00:00Z')
const at = (ms: number) => new Date(NOW.getTime() + ms)
const ROOT = '0x' + 'ab'.repeat(32)
const base: CampaignStatusInput = { status: 'Open', startDate: at(-3 * D), endDate: at(3 * D), participants: 11 }

const LIFECYCLE: [string, CampaignStatusInput][] = [
  ['Draft', { ...base, status: 'Draft' }],
  ['Upcoming', { ...base, startDate: at(2 * D), endDate: at(9 * D) }],
  ['Open', base],
  ['Open on-chain, end passed', { ...base, startDate: at(-20 * D), endDate: at(-2 * D) }],
  ['Ended, no list', { ...base, status: 'Ended', endDate: at(-2 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: '0x' + '00'.repeat(32) } }],
  ['Ended 14 d+, no list', { ...base, status: 'Ended', endDate: at(-20 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: '0x' + '00'.repeat(32) } }],
  ['List public, 24 h', { ...base, status: 'Ended', endDate: at(-2 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-6 * 60 * 60 * 1000) } }],
  ['Claims open', { ...base, status: 'Ended', endDate: at(-3 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-2 * D) } }],
  ['Closed, 30 days', { ...base, status: 'Closed', endDate: at(-9 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20RootPublishedAt: at(-8 * D), closedAt: at(-1 * D) } }],
  ['Closed, nobody qualified', { ...base, status: 'Closed', participants: 0, endDate: at(-9 * D) }],
  ['Swept', { ...base, status: 'Closed', endDate: at(-50 * D), settlement: { mode: 'MERKLE_ERC20', erc20MerkleRoot: ROOT, erc20Swept: true } }],
  ['Cancelled', { ...base, status: 'Cancelled' }],
]

const COVER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 280"><rect width="640" height="280" fill="#1B1916"/><circle cx="470" cy="150" r="96" fill="#8F530C"/><circle cx="470" cy="150" r="60" fill="#F2B45E"/><rect x="60" y="88" width="240" height="18" fill="#F4F1EA"/><rect x="60" y="122" width="170" height="12" fill="#A6A4A0"/></svg>',
  )

const STEPS = [
  { name: 'Details', hint: 'Name, schedule, image', href: '#stepper' },
  { name: 'Tasks', hint: 'What participants do', href: '#stepper' },
  { name: 'Rewards', hint: 'What they receive' },
  { name: 'Review', hint: 'Check, then create' },
]

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} id={id} className="scroll-mt-24">
      <SectionHeader id={`${id}-h`} title={title} note={note} />
      <div className="mt-6 grid gap-8">{children}</div>
    </section>
  )
}

function Demo({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="dd-eyebrow mb-3">{label}</p>
      {children}
    </div>
  )
}

const SWATCHES = ['paper', 'surface', 'sunk', 'ink', 'ink-2', 'ink-3', 'rule', 'rule-strong', 'signal', 'on-signal', 'danger'] as const

export function PrimitivesGallery() {
  const [seg, setSeg] = useState<'all' | 'open' | 'claims' | 'ended'>('all')
  const [desc, setDesc] = useState('Join the Example community')
  const [type, setType] = useState('payment')
  // Clock-dependent: set after mount so the server and client renders match.
  const [schedule, setSchedule] = useState<ScheduleState | null>(null)
  useEffect(() => setSchedule({ ...defaultScheduleState(), startMode: 'scheduled', preset: 'custom' }), [])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const toc = ['tokens', 'type', 'buttons', 'claim', 'chips', 'fields', 'stepper', 'headers', 'surfaces', 'stats', 'states', 'toasts']

  return (
    <div className="lp-container pb-24 pt-8 md:pt-14">
      <PageHeader
        eyebrow="Dev only · 08-site phase 1"
        title="Primitives"
        lead="Every app primitive in its states, for visual QA in both themes. This page returns a 404 in production builds."
        action={
          <Button asChild variant="secondary" size="sm">
            <a href="#states">Jump to states</a>
          </Button>
        }
      />
      <nav aria-label="Gallery sections" className="mt-8">
        <ul className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[0.8125rem]">
          {toc.map((t) => (
            <li key={t}>
              <a href={`#${t}`} className="inline-flex min-h-11 items-center text-ink-2 underline decoration-rule-strong underline-offset-4 can-hover:hover:text-ink">
                {t}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-12 grid gap-20">
        <Section id="tokens" title="Tokens" note="per theme">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {SWATCHES.map((t) => (
              <li key={t} className="rounded-[10px] border border-rule bg-surface p-3">
                <span aria-hidden="true" className="block h-12 rounded-md border border-rule" style={{ background: `var(--${t})` }} />
                <span className="mt-2 block font-mono text-[0.8125rem] text-ink">--{t}</span>
              </li>
            ))}
          </ul>
          <p className="text-small text-ink-2">
            Gold (<span className="font-mono">--signal</span>) is the reward and “now”. The red (<span className="font-mono">--danger</span>) is for errors and failed
            transactions only.
          </p>
        </Section>

        <Section id="type" title="Type">
          <div className="grid gap-4">
            <p className="dd-eyebrow">Eyebrow · JetBrains Mono 12 px</p>
            <p className="dd-display dd-h1 text-ink" aria-hidden="true">
              Display H1
            </p>
            <p className="dd-display dd-h2 text-ink" aria-hidden="true">
              Section H2
            </p>
            <p className="dd-lead">The lead: up to 46 characters a line, in ink-2, under the H1.</p>
            <p className="text-body text-ink">
              Body text in the system stack. <a href="#type" className="dd-link">A text link</a> turns gold on hover.
            </p>
            <p className="dd-mono text-small text-ink">Figures and addresses: 2,500 EXAMPLE · 0x3f9c…a1e2 · 19 Oct, 14:00</p>
          </div>
        </Section>

        <Section id="buttons" title="Buttons" note="pills · 48 / 44 px">
          <Demo label="Variants (md)">
            <div className="flex flex-wrap gap-3">
              <Button>Propose the list</Button>
              <Button variant="reward">Claim 250 EXAMPLE, gas-free</Button>
              <Button variant="secondary">Claim with my wallet</Button>
              <Button variant="ghost">Clear filters</Button>
              <Button variant="danger">Cancel campaign</Button>
            </div>
          </Demo>
          <Demo label="Small (44 px) · as a link · loading">
            <div className="flex flex-wrap gap-3">
              <Button size="sm">New campaign</Button>
              <Button size="sm" variant="secondary" asChild>
                <Link href="/campaigns" prefetch={false}>
                  Browse campaigns
                </Link>
              </Button>
              <Button size="sm" loading>
                Sending…
              </Button>
            </div>
          </Demo>
          <Demo label="Disabled always says why">
            <Button disabled disabledReason="Publish the reward list first: closing without one would leave nobody able to claim.">
              Close campaign
            </Button>
          </Demo>
        </Section>

        <Section id="claim" title="Claim buttons" note="gas-free first, wallet always">
          <Demo label="Gas-free available (the default)">
            <ClaimActions amountLabel="250 EXAMPLE" onSponsoredClaim={() => {}} onWalletClaim={() => {}} />
          </Demo>
          <Demo label="Gas-free in flight: the wallet claim stays live">
            <ClaimActions amountLabel="250 EXAMPLE" sponsored={{ phase: 'processing', status: 'PENDING' }} onSponsoredClaim={() => {}} onWalletClaim={() => {}} />
          </Demo>
          <Demo label="Gas-free failed → automatic fallback to the wallet">
            <ClaimActions
              amountLabel="250 EXAMPLE"
              sponsored={{ phase: 'unavailable', reason: "Today's gas budget is used up" }}
              onSponsoredClaim={() => {}}
              onRetrySponsored={() => {}}
              onWalletClaim={() => {}}
            />
          </Demo>
          <Demo label="Gas-free switched off (config flag)">
            <ClaimActions amountLabel="250 EXAMPLE" sponsoredEnabled={false} onWalletClaim={() => {}} />
          </Demo>
          <Demo label="Inside the 24-hour review">
            <ClaimActions amountLabel="250 EXAMPLE" onSponsoredClaim={() => {}} onWalletClaim={() => {}} disabledReason="Claims open 17 Oct, 14:00 (in 6 hours)." />
          </Demo>
          <Demo label="Wallet claim pending · failed transaction (the red)">
            <div className="grid gap-6">
              <ClaimActions amountLabel="250 EXAMPLE" onSponsoredClaim={() => {}} onWalletClaim={() => {}} walletPhase="confirm" />
              <ClaimActions
                amountLabel="250 EXAMPLE"
                sponsoredEnabled={false}
                onWalletClaim={() => {}}
                walletError="The claim didn't go through: this wallet has no Sepolia ETH for gas."
              />
            </div>
          </Demo>
          <Demo label="Claimed for you">
            <ClaimActions amountLabel="250 EXAMPLE" sponsored={{ phase: 'confirmed', txHash: null }} onWalletClaim={() => {}} />
          </Demo>
        </Section>

        <Section id="chips" title="Chips" note="the state is in the words">
          <Demo label="Lifecycle (from getCampaignStatus)">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {LIFECYCLE.map(([name, input]) => {
                const status = getCampaignStatus(input, NOW)
                return (
                  <li key={name} className="flex flex-wrap items-center gap-3">
                    <CampaignStatusChip status={status} />
                    <span className="text-[0.8125rem] text-ink-3">{name}</span>
                  </li>
                )
              })}
              <li className="flex flex-wrap items-center gap-3">
                <CampaignStatusChip status={getCampaignStatus({ ...base, status: 'Draft' }, NOW)} hostFundedDraft />
                <span className="text-[0.8125rem] text-ink-3">Host view</span>
              </li>
            </ul>
          </Demo>
          <Demo label="Payout · verification · example · failed transaction">
            <div className="flex flex-wrap items-center gap-2">
              <PayoutChip mode="MERKLE_ERC20" />
              <PayoutChip mode="RANK_TIERED" rankedCount={100} />
              <PayoutChip mode="SCORE_TIERED" />
              <PayoutChip mode="NFT" />
              <ExampleChip />
              <Chip variant="error" mark="!">
                Didn&apos;t go through
              </Chip>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <VerificationChip method="bot-membership" />
              <VerificationChip method="siwe-session" />
              <VerificationChip method="payment" />
              <VerificationChip method="humanity" />
              <VerificationChip method="self-reported" withNote />
            </div>
          </Demo>
        </Section>

        <Section id="fields" title="Form fields" note="48 px on sunk · red errors">
          <div className="grid gap-8 md:grid-cols-2">
            <Field label="Campaign name" help="People see this on the campaign card.">
              {(p) => <Input {...p} defaultValue="Example: Community week" />}
            </Field>
            <Field label="Amount" help="Per wallet, in the reward token." error="Enter an amount above 0." required>
              {(p) => <Input {...p} defaultValue="0" inputMode="decimal" />}
            </Field>
            <Field label="Description" optional count={<CharCount value={desc} min={50} />}>
              {(p) => <Textarea {...p} value={desc} onChange={(e) => setDesc(e.target.value)} />}
            </Field>
            <div className="grid content-start gap-8">
              <Field label="Token">
                {(p) => (
                  <NativeSelect {...p} defaultValue="eth">
                    <option value="eth">ETH (native)</option>
                    <option value="usdc">Example USD</option>
                  </NativeSelect>
                )}
              </Field>
              <Field label="Type" help="How each task is checked shows in the list.">
                {(p) => (
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger id={p.id} aria-describedby={p['aria-describedby']} className={controlClass('justify-between')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payment">Send a payment</SelectItem>
                      <SelectItem value="discord">Join a Discord server</SelectItem>
                      <SelectItem value="follow">Follow an account on X</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </Field>
            </div>
            <LockedField label="Network" value="Sepolia testnet" reason="Payments are checked on the network this app runs on." />
            <Segmented
              label="Status"
              value={seg}
              onChange={setSeg}
              options={[
                { value: 'all', label: 'All · 12' },
                { value: 'open', label: 'Open · 3' },
                { value: 'claims', label: 'Claims open · 2' },
                { value: 'ended', label: 'Ended · 7' },
              ]}
            />
          </div>
          <ErrorSummary
            focusOnMount={false}
            errors={[
              { id: 'gallery-amount', message: 'Enter an amount above 0.' },
              { id: 'gallery-pay-to', message: 'Enter the wallet that receives the payment.' },
            ]}
          />
          <Demo label="Date and time (the schedule picker, re-skinned; behaviour unchanged)" className="max-w-xl">
            {schedule && <ScheduleField value={schedule} onChange={setSchedule} />}
          </Demo>
        </Section>

        <Section id="stepper" title="Wizard stepper">
          <p className="dd-eyebrow">New campaign · {stepEyebrow(1, 4)}</p>
          <WizardStepper steps={STEPS} current={1} />
          <WizardStepper steps={STEPS} current={3} label="Steps (last step)" />
        </Section>

        <Section id="headers" title="Page header">
          <Panel tone="outline" className="overflow-hidden">
            <PageHeader
              size="md"
              back={{ href: '/campaigns', label: 'Campaigns' }}
              chips={
                <>
                  <CampaignStatusChip status={getCampaignStatus(LIFECYCLE[7][1], NOW)} />
                  <PayoutChip mode="MERKLE_ERC20" />
                  <ExampleChip />
                </>
              }
              title="Example: Community week"
              lead="Join the Example community, introduce yourself, and help us test the claim flow."
              meta={
                <>
                  <span>
                    Hosted by <span title="0x51e2c0f3aa000000000000000000000000b807bd">0x51e2…07bd</span>
                  </span>
                  <span>Campaign #12 on Sepolia</span>
                </>
              }
            />
          </Panel>
        </Section>

        <Section id="surfaces" title="Panels and cards">
          <div className="grid gap-6 md:grid-cols-2">
            <Panel eyebrow="The campaign">
              <KeyValueList
                items={[
                  { label: 'Reward pool', value: '2,500 EXAMPLE' },
                  { label: 'Payout', value: 'Equal split' },
                  { label: 'Participants', value: '11' },
                  { label: 'Ran', value: '1–8 Oct' },
                  { label: 'Escrow', value: '0x9a1c…77e0', title: '0x9a1c000000000000000000000000000000077e0' },
                  { label: 'Network', value: 'Sepolia testnet' },
                ]}
              />
            </Panel>
            <div className="grid gap-4">
              <Panel tone="strong">
                <p className="dd-eyebrow">Panel · strong</p>
                <p className="mt-2 text-small text-ink-2">The claim panel when it&apos;s the main thing on the page.</p>
              </Panel>
              <Panel tone="sunk">
                <p className="dd-eyebrow">Panel · sunk</p>
                <p className="mt-2 text-small text-ink-2">Quiet summaries and the AI starter.</p>
              </Panel>
            </div>
          </div>
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <li>
              <CardLink
                href="/campaigns"
                title="Example: Validator onboarding"
                top={
                  <>
                    <CampaignStatusChip status={getCampaignStatus(base, NOW)} />
                    <PayoutChip mode="MERKLE_ERC20" className="ml-auto" />
                  </>
                }
              >
                <p className="font-mono text-[0.8125rem] text-ink-2">Hosted by 0x7a1c…9c03</p>
                <KeyValueList
                  className="mt-1 border-t border-rule [&_dd]:text-[0.8125rem] [&_dt]:text-small"
                  items={[
                    { label: 'Reward pool', value: '1,000 EXAMPLE' },
                    { label: 'Participants', value: '38 of 500' },
                    { label: 'Ends', value: 'in 3 days · 19 Oct' },
                  ]}
                />
                <p className="mt-auto border-t border-rule pt-3 text-[0.8125rem] text-ink-2">3 tasks · 2 checked · 1 self-reported</p>
              </CardLink>
            </li>
            <li>
              <CardLink
                href="/campaigns"
                title="Example: Community week"
                cover={{ src: COVER, alt: '' }}
                top={
                  <>
                    <CampaignStatusChip status={getCampaignStatus(LIFECYCLE[7][1], NOW)} />
                    <PayoutChip mode="MERKLE_ERC20" className="ml-auto" />
                  </>
                }
              >
                <p className="font-mono text-[0.8125rem] text-ink-2">Hosted by 0x51e2…07bd</p>
                <p className="mt-auto border-t border-rule pt-3 text-[0.8125rem] text-signal">You joined · 3 of 3 done · 250 EXAMPLE for you</p>
              </CardLink>
            </li>
            <li>
              <CardSkeleton />
            </li>
          </ul>
        </Section>

        <Section id="stats" title="Stat row">
          <StatRow
            stats={[
              { label: 'Campaigns', value: '4' },
              { label: 'Open now', value: '1' },
              { label: 'Participants', value: '120' },
              { label: 'Gas-free claims', value: null },
            ]}
          />
        </Section>

        <Section id="states" title="Loading, empty, error">
          <LoadingRegion label="Loading tasks" className="grid gap-6 md:grid-cols-2">
            <RowsSkeleton count={3} />
            <ClaimSkeleton />
          </LoadingRegion>
          <EmptyState
            headingLevel="h3"
            title="No campaigns yet."
            body="Your first one takes about 5 minutes."
            action={
              <Button asChild size="sm">
                <Link href="/create-campaign" prefetch={false}>
                  New campaign
                </Link>
              </Button>
            }
          />
          <ErrorState
            headingLevel="h3"
            live={false}
            title="We couldn't load campaigns."
            reason="The indexer didn't answer. Nothing is wrong with your rewards."
            action={
              <Button size="sm" variant="secondary">
                Try again
              </Button>
            }
          />
        </Section>

        <Section id="toasts" title="Toasts and dialogs">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              size="sm"
              data-demo="toast-success"
              onClick={() => toast({ title: 'List published', description: 'Claims open 17 Oct, 14:00. View on Etherscan ↗' })}
            >
              Show a success toast
            </Button>
            <Button
              variant="secondary"
              size="sm"
              data-demo="toast-error"
              onClick={() => toast({ variant: 'destructive', title: "Can't close yet", description: 'Publish the reward list first.' })}
            >
              Show an error toast
            </Button>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              trigger={
                <Button variant="secondary" size="sm" data-demo="dialog">
                  Open a confirm dialog
                </Button>
              }
              title="Close this campaign?"
              body="The list is frozen, and participants then have 30 days to claim. You can't reopen it."
              confirmLabel="Close campaign"
              onConfirm={() => {}}
            />
            <ConfirmDialog
              trigger={
                <Button variant="secondary" size="sm" data-demo="dialog-destructive">
                  Open a destructive confirm
                </Button>
              }
              title="Cancel this campaign?"
              body="Nobody has joined, so the full reward goes back to your wallet. You can't undo this."
              confirmLabel="Cancel campaign"
              destructive
              onConfirm={() => {}}
            />
          </div>
        </Section>
      </div>
    </div>
  )
}
