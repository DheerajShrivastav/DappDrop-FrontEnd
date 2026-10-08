import { Frame } from './frame'

// Labels copied from the app (create-campaign/page.tsx: steps, "Funding breakdown",
// "What happens when you click Create", tx step labels; lib/campaign-funnel.ts: stages).
// No imports from the app: these are pictures of it, not it.

const RAIL = ['Details', 'Tasks', 'Rewards', 'Review']

export function BuildReplica() {
  return (
    <Frame fig={1} caption="The wizard drafts your details; skip it if you’d rather write">
      <ol className="flex gap-1.5">
        {RAIL.map((s, i) => (
          <li key={s} className={`flex-1 border-t-2 pt-1 text-[0.6875rem] ${i === 0 ? 'border-ink text-ink' : 'border-rule text-ink-3'}`}>
            {i + 1} {s}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-ink-3">Title</p>
      <p className="rounded border border-rule px-2 py-1">Example Quest: join, follow, earn</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <span className="rounded bg-ink px-2 py-1 text-paper">Generate with AI</span>
        <span className="rounded border border-rule-strong px-2 py-1">Skip &amp; Create Manually</span>
      </div>
    </Frame>
  )
}

export function FundReplica() {
  return (
    <Frame fig={2} caption="The transactions you’ll sign, before you sign them">
      <p className="font-medium">Funding breakdown</p>
      <dl className="mt-1 space-y-0.5 font-mono text-[0.75rem]">
        <div className="flex justify-between">
          <dt className="font-sans text-ink-2">Taken from your wallet</dt>
          <dd>1,000 EXAMPLE</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-sans text-ink-2">Protocol fee</dt>
          <dd>0</dd>
        </div>
        <div className="flex justify-between border-t border-rule pt-0.5 font-medium">
          <dt className="font-sans">Escrowed for rewards</dt>
          <dd>1,000 EXAMPLE</dd>
        </div>
      </dl>
      <p className="mt-2.5 font-medium">What happens when you click Create</p>
      <ol className="mt-1 space-y-0.5 text-ink-2">
        <li>1 · Create the campaign and add its tasks</li>
        <li>2 · Set the reward token, approve EXAMPLE if needed, and fund the pool</li>
        <li>3 · Sign a message to save the image and descriptions (no gas)</li>
      </ol>
    </Frame>
  )
}

const FUNNEL: [string, number][] = [
  ['Joined', 120],
  ['Started a task', 96],
  ['Qualified', 64],
  ['Claimed', 58],
]

export function RunReplica() {
  return (
    <Frame fig={3} caption="Your participant funnel (example numbers)">
      <ul className="space-y-1.5">
        {FUNNEL.map(([k, v]) => (
          <li key={k} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2">
            <span className="text-ink-2">{k}</span>
            <span className="h-2 rounded-full bg-sunk">
              <span className="block h-2 rounded-full bg-ink-2" style={{ width: `${(v / 120) * 100}%` }} />
            </span>
            <span className="text-right font-mono text-[0.75rem]">{v}</span>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

export function SettleReplica() {
  const steps = ['Ended on schedule', 'List public · 24 h', 'Claims open', 'You close it · 30 more days', 'Reclaim what’s left']
  return (
    <Frame fig={4} caption="Settling: the same rules as the statement">
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 ${i === 1 ? 'font-medium text-signal' : 'text-ink-2'}`}>
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${i === 1 ? 'bg-signal' : 'bg-ink-3'}`} />
            {s}
          </li>
        ))}
      </ol>
    </Frame>
  )
}
