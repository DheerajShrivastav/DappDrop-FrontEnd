'use client'

import { useState } from 'react'
import { Button, Input, Textarea, plural } from '@/components/app'
import { parsePastedNftList, type NftRow } from '@/lib/reward-plan'

/**
 * Token IDs to deposit, one row per prize. Replaces two parallel textareas (IDs, and for ERC1155
 * a separate list of quantities that had to line up entry-for-entry). Bulk entry stays fast via
 * "Paste a list". The page serialises rows back to the form's tokenIds/tokenAmounts strings, so
 * submit is unchanged.
 */
export function NftTokenTable({
  rows,
  onChange,
  standard,
}: {
  rows: NftRow[]
  onChange: (rows: NftRow[]) => void
  standard: 'ERC721' | 'ERC1155'
}) {
  const withQty = standard === 'ERC1155'
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const update = (i: number, patch: Partial<NftRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const count = rows.filter((r) => r.id.trim()).length

  const cols = withQty ? 'grid-cols-[minmax(0,1fr)_6.5rem_4.5rem]' : 'grid-cols-[minmax(0,1fr)_4.5rem]'
  return (
    <div className="grid gap-3">
      <div className="rounded-md border border-rule-strong">
        <div aria-hidden="true" className={`grid gap-3 border-b border-rule px-3 py-2 font-mono text-[0.75rem] uppercase tracking-[0.08em] text-ink-3 ${cols}`}>
          <span>Token ID</span>
          {withQty && <span>Quantity</span>}
          <span />
        </div>
        <div className="grid max-h-80 gap-2 overflow-y-auto p-3">
          {rows.length === 0 && <p className="text-[0.875rem] text-ink-2">No tokens yet. Add one or paste a list.</p>}
          {rows.map((r, i) => (
            <div key={i} className={`grid items-center gap-3 ${cols}`}>
              <Input value={r.id} inputMode="numeric" placeholder="e.g. 42" aria-label={`Token ID, row ${i + 1}`} onChange={(e) => update(i, { id: e.target.value })} className="font-mono" />
              {withQty && <Input value={r.qty} inputMode="numeric" aria-label={`Quantity, row ${i + 1}`} onChange={(e) => update(i, { qty: e.target.value })} className="font-mono" />}
              <button type="button" className="dd-link min-h-11 justify-self-end text-small text-ink" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove row ${i + 1}`}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" onClick={() => onChange([...rows, { id: '', qty: '1' }])}>
          + Add a token
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen}>
          Paste a list
        </Button>
        <span className="ml-auto font-mono text-[0.8125rem] text-ink-2">{plural(count, 'prize')}</span>
      </div>

      {pasteOpen && (
        <div className="grid gap-3 rounded-md border border-rule-strong p-3">
          <Textarea
            rows={4}
            aria-label="Token list to paste"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={withQty ? 'One per line: token ID then quantity\n42 5\n43 1' : '42, 43, 44\nor one per line'}
            className="font-mono text-[0.875rem]"
          />
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              onClick={() => {
                const added = parsePastedNftList(pasteText, withQty)
                // Replace a lone empty starter row instead of keeping it above the pasted list.
                const base = rows.length === 1 && !rows[0].id.trim() ? [] : rows
                onChange([...base, ...added])
                setPasteText('')
                setPasteOpen(false)
              }}
              disabled={!pasteText.trim()}
              disabledReason="Paste some token IDs first."
            >
              Add these
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
