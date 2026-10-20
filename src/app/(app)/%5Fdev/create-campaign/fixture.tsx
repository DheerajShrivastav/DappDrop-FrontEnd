'use client'

import Link from 'next/link'
import { CreateCampaign, type WizardFixture, type WizardWallet } from '../../create-campaign/_components/create-campaign'
import type { CampaignFormValues } from '../../create-campaign/_components/campaign-form'

// Example data only: nothing here is read from or sent to the chain.
const ADDR = '0x3f9c4b1e8d2a7c6f5e0b9a8d7c6e5f4a3b2ca1e2'
const TOKEN = '0x51e2c0f3a4b5c6d7e8f9a0b1c2d3e4f5b8a907bd'
const host: WizardWallet = { address: ADDR, isConnected: true, role: 'host', checkRoles: async () => {} }
const nobody: WizardWallet = { address: null, isConnected: false, role: null, checkRoles: async () => {} }

const details: Partial<CampaignFormValues> = {
  title: 'Example: Testnet launch quest',
  shortDescription: 'Try the Example protocol on Sepolia and join the community.',
  description: 'Example is a lending protocol on Sepolia. Take a test loan, join our Discord and follow us on X to qualify for a share of the pool.',
}
const tasks: CampaignFormValues['tasks'] = [
  { type: 'JOIN_DISCORD', description: 'Join the Example Discord server', verificationData: '1024849645714206720', discordInviteLink: 'https://discord.gg/example', isOptional: false },
  { type: 'SOCIAL_FOLLOW', description: 'Follow @example on X', isOptional: true },
  {
    type: 'ONCHAIN_TX',
    description: 'Send 0.001 Sepolia ETH to the Example project wallet',
    paymentRequired: true,
    paymentRecipient: TOKEN,
    tokenSymbol: 'ETH',
    amount: '0',
    isOptional: false,
  },
]
const erc20 = (extra: Record<string, unknown> = {}) =>
  ({ type: 'ERC20', tokenAddress: '0x', amount: '2500', name: '', settlementMode: 'MERKLE', rankTiers: [], scoreTiers: [], taskPoints: [], ...extra }) as CampaignFormValues['reward']
const full = (reward: CampaignFormValues['reward'], t = tasks.map((x) => (x.type === 'ONCHAIN_TX' ? { ...x, amount: '0.001', amountDisplay: '0.001 ETH' } : x))) => ({ ...details, tasks: t, reward })

const DAY = 24 * 60 * 60 * 1000
const STATES: Record<string, { wallet: WizardWallet; fixture: WizardFixture; note: string }> = {
  'gate-none': { wallet: nobody, fixture: { gate: { connection: 'none', state: { kind: 'idle' } } }, note: 'Host gate, not connected' },
  'gate-checking': { wallet: host, fixture: { gate: { connection: 'checking', state: { kind: 'idle' } } }, note: 'Host gate, connected, role check in flight' },
  'gate-connected': { wallet: host, fixture: { gate: { connection: 'connected', state: { kind: 'idle' } } }, note: 'Host gate, connected' },
  'gate-wrong-network': { wallet: host, fixture: { gate: { connection: 'wrong-network', state: { kind: 'idle' } } }, note: 'Host gate, wrong network' },
  'gate-pending': { wallet: host, fixture: { gate: { connection: 'connected', state: { kind: 'pending' } } }, note: 'Host gate, waiting for the wallet' },
  'gate-failed': {
    wallet: host,
    fixture: { gate: { connection: 'connected', state: { kind: 'failed', reason: 'This wallet doesn’t have enough Sepolia ETH for gas. Get a little from a faucet, then try again.' } } },
    note: 'Host gate, didn’t go through',
  },
  'gate-granted': { wallet: host, fixture: { gate: { connection: 'connected', state: { kind: 'granted' } } }, note: 'Host gate, host role added' },
  details: { wallet: host, fixture: { step: 1 }, note: 'Step 1, empty, AI panel open' },
  'details-generating': { wallet: host, fixture: { step: 1, generating: true, aiPrompt: 'Example is a lending protocol on Sepolia. We want testers to take a loan and join our Discord.' }, note: 'Step 1, AI drafting' },
  'details-ai-error': {
    wallet: host,
    fixture: { step: 1, aiPrompt: 'Example is a lending protocol on Sepolia.', generationError: { message: 'The AI service is busy right now. Try again in a minute, or write it yourself.', retryable: true, category: 'rate_limit' } },
    note: 'Step 1, AI draft failed',
  },
  'details-errors': { wallet: host, fixture: { step: 1, aiOpen: false, values: { title: 'Ex' }, continueOnMount: true }, note: 'Step 1, Continue with errors (summary + inline)' },
  'details-filled': { wallet: host, fixture: { step: 1, aiOpen: false, values: { ...details, tasks } }, note: 'Step 1, filled' },
  tasks: { wallet: host, fixture: { step: 2, values: { ...details, tasks }, collapseFirst: 2, continueOnMount: true, feeCapNote: true }, note: 'Step 2 (the mockup): two collapsed tasks, a payment task with an error; fee-cap note previewed' },
  rewards: { wallet: host, fixture: { step: 3, values: full(erc20()) }, note: 'Step 3, equal split' },
  'rewards-ranked': {
    wallet: host,
    fixture: { step: 3, values: full(erc20({ settlementMode: 'RANK_TIERED', rankTiers: [{ startRank: 1, endRank: 10, amount: '100' }, { startRank: 11, endRank: 50, amount: '25' }] })) },
    note: 'Step 3, ranked tiers',
  },
  'rewards-score': {
    wallet: host,
    fixture: { step: 3, values: { ...full(erc20({ settlementMode: 'SCORE_TIERED', scoreTiers: [{ minScore: 10, amount: '50' }, { minScore: 10, amount: '80' }], taskPoints: [10, 5, 0] })), humanityGated: true } },
    note: 'Step 3, score tiers with a rule error and a self-reported points warning; humanity notice',
  },
  'rewards-locked': {
    wallet: host,
    fixture: { step: 3, campaignCreated: true, pendingFunded: true, values: full(erc20({ tokenAddress: TOKEN })) },
    note: 'Step 3 after funding: the reward is locked (PR #42)',
  },
  review: { wallet: host, fixture: { step: 4, values: { ...full(erc20({ tokenAddress: TOKEN })), maxParticipants: '500' } }, note: 'Step 4, review' },
  'review-retry': {
    wallet: host,
    fixture: { step: 4, campaignCreated: true, values: full(erc20({ tokenAddress: TOKEN })) },
    note: 'Step 4 after a failed funding tx: step 01 Done, Create again skips it',
  },
  created: { wallet: host, fixture: { step: 4, phase: 'created', createdCampaignId: '12', submittedEndDate: new Date(Date.now() + 7 * DAY), values: full(erc20()) }, note: 'Created phase' },
  'created-expired': {
    wallet: host,
    fixture: { step: 4, phase: 'created', createdCampaignId: '12', submittedEndDate: new Date(Date.now() - DAY), values: full(erc20()) },
    note: 'Created phase, end time already passed',
  },
}

export function CreateCampaignFixture({ state }: { state: string }) {
  const s = STATES[state]
  if (!s) {
    return (
      <div className="lp-container py-14">
        <h1 className="dd-display dd-h1-sm text-ink">Create-campaign fixture</h1>
        <p className="mt-2 text-ink-2">Dev only. Example data; nothing is sent.</p>
        <ul className="mt-6 grid gap-2">
          {Object.entries(STATES).map(([k, v]) => (
            <li key={k}>
              <Link className="dd-link" href={`/_dev/create-campaign?state=${k}`} prefetch={false}>
                {k}
              </Link>{' '}
              <span className="text-small text-ink-2">· {v.note}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  // Remount per state so every fixture starts from its own initial values.
  return <CreateCampaign key={state} wallet={s.wallet} fixture={s.fixture} />
}
