'use client'

import { Button, CharCount, Field, Panel, Spinner, Textarea } from '@/components/app'
import { Notice } from './wizard-ui'

export type GenerationError = { message: string; retryable: boolean; category: string }

/**
 * "Generate with AI" (the old step 0), as a quiet panel above the Details form (app-design §2.5):
 * "Start from a short description (optional)", with the elapsed timer and Cancel in mono. The
 * generate / cancel / give-up logic stays in the page; this is only its view.
 */
export function AiDraftPanel({
  open,
  onOpen,
  prompt,
  onPromptChange,
  isGenerating,
  seconds,
  error,
  onGenerate,
  onCancel,
  onSkip,
}: {
  open: boolean
  onOpen: () => void
  prompt: string
  onPromptChange: (v: string) => void
  isGenerating: boolean
  seconds: number
  error: GenerationError | null
  onGenerate: () => void
  onCancel: () => void
  /** "Write it myself": closes the panel (and stops waiting for a draft in flight). */
  onSkip: () => void
}) {
  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[10px] border border-dashed border-rule-strong px-5 py-3">
        <p className="text-[0.875rem] text-ink-2">Have a short description of your project? AI can draft the name, descriptions and tasks.</p>
        <Button size="sm" variant="ghost" onClick={onOpen}>
          Draft with AI
        </Button>
      </div>
    )
  }

  const short = prompt.trim().length < 20
  return (
    <Panel tone="sunk" as="section" aria-labelledby="ai-draft-h" data-ai-draft>
      <h2 id="ai-draft-h" className="text-[1.0625rem] font-semibold text-ink">
        Start from a short description <span className="font-normal text-ink-3">(optional)</span>
      </h2>
      <p className="mt-1 max-w-[60ch] text-[0.875rem] leading-relaxed text-ink-2">
        AI drafts the name, both descriptions and the tasks. It replaces what’s in those fields, and you can edit everything before you create.
      </p>
      <Field className="mt-4" id="f-aiPrompt" label="Describe your project" count={<CharCount value={prompt.trim()} min={20} />}>
        {(p) => (
          <Textarea
            {...p}
            placeholder="E.g. a lending protocol on Sepolia that lets people borrow against their NFTs. We want early testers to try a loan and join our Discord."
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            rows={4}
            disabled={isGenerating}
          />
        )}
      </Field>

      {/* Honest progress: elapsed time, not a guessed stage. */}
      {isGenerating && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-4" role="status" aria-live="polite">
          <Spinner className="text-ink-2" />
          <p className="min-w-0 flex-1 text-[0.875rem] text-ink">
            Drafting your campaign… <span className="font-mono text-ink-2">{seconds}s</span>
            <span className="block text-[0.8125rem] text-ink-2">
              {seconds < 45 ? 'Planning, writing and checking it: usually 10–40 seconds.' : 'Still working: the AI service is slower than usual right now.'}
            </span>
          </p>
          <button type="button" onClick={onCancel} className="min-h-11 font-mono text-[0.8125rem] uppercase tracking-[0.08em] text-ink-2 underline decoration-rule-strong underline-offset-4 can-hover:hover:text-ink">
            Cancel
          </button>
        </div>
      )}

      {error && !isGenerating && (
        <Notice tone="error" className="mt-4" live title="The draft didn’t work">
          <p>{error.message}</p>
          {error.retryable && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={onGenerate}>
              Try again
            </Button>
          )}
        </Notice>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        {/* Always available: a slow AI response must never trap the host here. */}
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Write it myself
        </Button>
        <Button
          size="sm"
          onClick={onGenerate}
          loading={isGenerating}
          disabled={isGenerating || short}
          disabledReason={!isGenerating && short ? 'Write at least 20 characters first.' : undefined}
        >
          {isGenerating ? 'Drafting…' : 'Draft my campaign'}
        </Button>
      </div>
    </Panel>
  )
}
