'use client'

import { useState } from 'react'
import { ClipboardList, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <div
          className={`grid gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground ${
            withQty ? 'grid-cols-[1fr_6rem_2.25rem]' : 'grid-cols-[1fr_2.25rem]'
          }`}
        >
          <span>Token ID</span>
          {withQty && <span>Quantity</span>}
          <span className="sr-only">Remove</span>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto p-3">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No tokens yet — add one or paste a list.</p>
          )}
          {rows.map((r, i) => (
            <div
              key={i}
              className={`grid items-center gap-2 ${withQty ? 'grid-cols-[1fr_6rem_2.25rem]' : 'grid-cols-[1fr_2.25rem]'}`}
            >
              <Input
                value={r.id}
                inputMode="numeric"
                placeholder="e.g. 42"
                aria-label={`Token ID, row ${i + 1}`}
                onChange={(e) => update(i, { id: e.target.value })}
                className="font-mono"
              />
              {withQty && (
                <Input
                  value={r.qty}
                  inputMode="numeric"
                  aria-label={`Quantity, row ${i + 1}`}
                  onChange={(e) => update(i, { qty: e.target.value })}
                  className="font-mono"
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                aria-label={`Remove row ${i + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { id: '', qty: '1' }])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add token
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setPasteOpen((o) => !o)}>
          <ClipboardList className="mr-1 h-3.5 w-3.5" /> Paste a list
        </Button>
        <span className="ml-auto text-sm text-muted-foreground">
          {count} prize{count === 1 ? '' : 's'}
        </span>
      </div>

      {pasteOpen && (
        <div className="space-y-2 rounded-md border p-3">
          <Textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={withQty ? 'One per line: token ID then quantity\n42 5\n43 1' : '42, 43, 44\nor one per line'}
            className="font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button
              type="button"
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
            >
              Add these
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
