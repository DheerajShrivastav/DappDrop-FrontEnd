/**
 * AS-2: where the tokens sit. A static inline SVG (1.5 px ink strokes), horizontal from 640 px
 * and vertical below (value falls downward on phone). Its text alternative says exactly what
 * TRS F12 requires and nothing like "secured" or "safe".
 */
const ALT = 'Host wallet → escrow contract → participant wallets. No DappDrop wallet in the path.'

const box = { fill: 'var(--surface)', stroke: 'var(--ink)', strokeWidth: 1.5 }
const arrow = { stroke: 'var(--ink)', strokeWidth: 1.5, fill: 'none' }
const label = { fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: 14, fill: 'var(--ink)' }
const meta = { fontFamily: 'var(--font-mono, ui-monospace), ui-monospace, monospace', fontSize: 11, fill: 'var(--ink-2)' }

function Arrowhead({ id }: { id: string }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0 0 10 5 0 10z" fill="var(--ink)" />
    </marker>
  )
}

export function MoneyDiagram() {
  return (
    <figure className="m-0">
      {/* Horizontal (≥ 640 px) */}
      <svg viewBox="0 0 560 170" role="img" aria-label={ALT} className="hidden h-auto w-full sm:block">
        <defs>
          <Arrowhead id="mdh" />
        </defs>
        <rect x="2" y="55" width="130" height="60" rx="8" {...box} />
        <text x="67" y="83" textAnchor="middle" {...label}>Host wallet</text>
        <text x="67" y="101" textAnchor="middle" {...meta}>you</text>
        <path d="M134 85H206" markerEnd="url(#mdh)" {...arrow} />
        <text x="170" y="74" textAnchor="middle" {...meta}>fund</text>
        <rect x="210" y="40" width="150" height="90" rx="4" {...box} strokeWidth={2.5} />
        <text x="285" y="80" textAnchor="middle" {...label}>Escrow contract</text>
        <text x="285" y="99" textAnchor="middle" {...meta}>on-chain, verified</text>
        <path d="M362 85C392 85 392 30 420 30" markerEnd="url(#mdh)" {...arrow} />
        <path d="M362 85H420" markerEnd="url(#mdh)" {...arrow} />
        <path d="M362 85C392 85 392 140 420 140" markerEnd="url(#mdh)" {...arrow} />
        <text x="390" y="20" textAnchor="middle" {...meta}>claim</text>
        {[30, 85, 140].map((y) => (
          <g key={y}>
            <rect x="424" y={y - 17} width="134" height="34" rx="8" {...box} />
            <text x="491" y={y + 5} textAnchor="middle" {...label}>Participant wallet</text>
          </g>
        ))}
      </svg>
      {/* Vertical (< 640 px): compact, value falls downward. */}
      <svg viewBox="0 0 300 250" role="img" aria-label={ALT} className="mx-auto block h-auto w-full max-w-[18rem] sm:hidden">
        <defs>
          <Arrowhead id="mdv" />
        </defs>
        <rect x="80" y="2" width="140" height="44" rx="8" {...box} />
        <text x="150" y="29" textAnchor="middle" {...label}>Host wallet · you</text>
        <path d="M150 48V78" markerEnd="url(#mdv)" {...arrow} />
        <text x="160" y="68" {...meta}>fund</text>
        <rect x="65" y="82" width="170" height="62" rx="4" {...box} strokeWidth={2.5} />
        <text x="150" y="110" textAnchor="middle" {...label}>Escrow contract</text>
        <text x="150" y="128" textAnchor="middle" {...meta}>on-chain, verified</text>
        <path d="M150 146C150 166 50 166 50 190" markerEnd="url(#mdv)" {...arrow} />
        <path d="M150 146V190" markerEnd="url(#mdv)" {...arrow} />
        <path d="M150 146C150 166 250 166 250 190" markerEnd="url(#mdv)" {...arrow} />
        <text x="160" y="176" {...meta}>claim</text>
        {[50, 150, 250].map((x) => (
          <g key={x}>
            <rect x={x - 47} y="194" width="94" height="52" rx="8" {...box} />
            <text x={x} y="216" textAnchor="middle" {...label} fontSize={12}>Participant</text>
            <text x={x} y="233" textAnchor="middle" {...label} fontSize={12}>wallet</text>
          </g>
        ))}
      </svg>
    </figure>
  )
}
