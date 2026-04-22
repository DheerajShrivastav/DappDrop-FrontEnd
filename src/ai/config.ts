// src/ai/config.ts
// Vercel AI SDK configuration with Google Gemini provider
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
})

// Default model for all agents
export const model = google('gemini-3-flash-preview')

// Max retries for the validator → generator feedback loop
export const MAX_VALIDATION_RETRIES = 2
