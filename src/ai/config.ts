// src/ai/config.ts
// Vercel AI SDK configuration with Google Gemini provider
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
})

/**
 * Model for every agent. Override with GEMINI_MODEL.
 *
 * Why the default is still a "-preview" id: it's the one that actually works. Checked live
 * against the Gemini API on 2026-10-01 with this project's key —
 *   - gemini-2.5-flash (the last GA flash id in @ai-sdk/google's typings) is rejected:
 *     "no longer available to new users"
 *   - gemini-3.8-flash (what that rejection recommends) exists but answered "high demand" on
 *     every attempt
 *   - gemini-flash-latest timed out / "high demand"
 *   - gemini-3-flash-preview answered every attempt in ~2.5–3.5s for a small structured call
 * Re-check before changing it, and prefer setting GEMINI_MODEL over editing this default.
 */
export const GEMINI_MODEL_ID = process.env.GEMINI_MODEL?.trim() || 'gemini-3-flash-preview'

export const model = google(GEMINI_MODEL_ID)

// Max validator → generator feedback rounds. The pipeline's time budget (below) bounds these
// too: a round only starts if there's time left to finish it.
export const MAX_VALIDATION_RETRIES = 2

const intFromEnv = (name: string, fallback: number) => {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Hard ceiling for any single model call (planner, generator, validator). */
export const AI_CALL_TIMEOUT_MS = intFromEnv('CAMPAIGN_AI_CALL_TIMEOUT_MS', 30_000)

/**
 * Wall-clock budget for the whole pipeline. Once it's spent, generation stops improving and
 * returns the best draft it has (validation is best-effort). Must stay comfortably under the
 * create-campaign route's maxDuration (create-campaign/layout.tsx) and under the client's
 * give-up guard (page.tsx), or the user waits on a request the server already gave up on.
 */
export const AI_PIPELINE_BUDGET_MS = intFromEnv('CAMPAIGN_AI_BUDGET_MS', 70_000)

/**
 * Keep reasoning short. These are small structured-output tasks; long hidden reasoning was most
 * of the latency and, for the validator, ate into the output budget until its JSON was cut off.
 * Gemini 3 takes a reasoning *level*; Gemini 2.5 takes a token *budget* — send the field the
 * configured model actually understands.
 */
export function thinkingOptions(level: 'low' | 'minimal' = 'low') {
  const id = GEMINI_MODEL_ID
  if (/^gemini-2\.5/.test(id)) {
    return { google: { thinkingConfig: { thinkingBudget: level === 'minimal' ? 0 : 512 } } }
  }
  if (/^gemini-3/.test(id)) {
    return { google: { thinkingConfig: { thinkingLevel: level } } }
  }
  return undefined // unknown family: don't send options it may reject
}
