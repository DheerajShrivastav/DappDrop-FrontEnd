// ── Error handling ───────────────────────────────────────────────────────────

export type GenerationStage = 'planning' | 'generating' | 'validating'
export type GenerationErrorCategory =
  | 'rate_limit'
  | 'api_error'
  | 'validation'
  | 'network'
  | 'config'
  | 'unknown'

/**
 * Structured metadata that can survive server-action serialization.
 * Encoded as a JSON prefix in the error message.
 */
export interface CampaignGenerationErrorData {
  stage: GenerationStage
  category: GenerationErrorCategory
  userMessage: string
  retryable: boolean
}

const ERROR_PREFIX = '[[CGE]]'

export class CampaignGenerationError extends Error {
  public readonly stage: GenerationStage
  public readonly category: GenerationErrorCategory
  public readonly userMessage: string
  public readonly retryable: boolean

  constructor(opts: {
    stage: GenerationStage
    category: GenerationErrorCategory
    userMessage: string
    retryable: boolean
    cause?: unknown
  }) {
    // Encode metadata into the message so it survives server-action serialization.
    // Next.js strips custom properties from server action errors, leaving only .message.
    const payload: CampaignGenerationErrorData = {
      stage: opts.stage,
      category: opts.category,
      userMessage: opts.userMessage,
      retryable: opts.retryable,
    }
    super(`${ERROR_PREFIX}${JSON.stringify(payload)}`)
    this.name = 'CampaignGenerationError'
    this.stage = opts.stage
    this.category = opts.category
    this.userMessage = opts.userMessage
    this.retryable = opts.retryable
    this.cause = opts.cause
  }
}

/**
 * Parse a CampaignGenerationError from a server-action error message.
 * Returns the structured data if present, or null if the error
 * is not a CampaignGenerationError.
 */
export function parseCampaignGenerationError(
  error: unknown,
): CampaignGenerationErrorData | null {
  const message = (error as any)?.message ?? String(error)
  if (!message.startsWith(ERROR_PREFIX)) return null
  try {
    return JSON.parse(message.slice(ERROR_PREFIX.length))
  } catch {
    return null
  }
}

/**
 * Inspect a raw error from the AI SDK and translate it into a
 * user-friendly CampaignGenerationError.
 */
export function wrapAIError(
  raw: unknown,
  stage: GenerationStage,
): CampaignGenerationError {
  const err = raw as any
  const message: string = err?.message ?? String(raw)
  const statusCode: number | undefined =
    err?.statusCode ?? err?.lastError?.statusCode ?? err?.data?.error?.code

  // 1) Rate-limit / overloaded (429, 503)
  if (
    statusCode === 429 ||
    statusCode === 503 ||
    message.includes('high demand') ||
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('UNAVAILABLE') ||
    message.includes('overloaded') ||
    message.includes('Too Many Requests')
  ) {
    return new CampaignGenerationError({
      stage,
      category: 'rate_limit',
      userMessage:
        'The AI service is currently experiencing high demand. Please wait a minute and try again.',
      retryable: true,
      cause: raw,
    })
  }

  // 2) Auth / API key issues (401, 403)
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    message.includes('API key') ||
    message.includes('authentication') ||
    message.includes('permission') ||
    message.includes('PERMISSION_DENIED')
  ) {
    return new CampaignGenerationError({
      stage,
      category: 'config',
      userMessage:
        'AI service authentication failed. Please contact the site administrator.',
      retryable: false,
      cause: raw,
    })
  }

  // 3) Network errors
  if (
    message.includes('fetch failed') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('network') ||
    message.includes('ENOTFOUND') ||
    err?.code === 'UND_ERR_CONNECT_TIMEOUT'
  ) {
    return new CampaignGenerationError({
      stage,
      category: 'network',
      userMessage:
        'Could not connect to the AI service. Please check your internet connection and try again.',
      retryable: true,
      cause: raw,
    })
  }

  // 4) Zod / validation errors
  if (
    err?.name === 'ZodError' ||
    message.includes('validation') ||
    message.includes('ZodError')
  ) {
    return new CampaignGenerationError({
      stage,
      category: 'validation',
      userMessage:
        'The AI generated an invalid response. Please try again with a more detailed project description.',
      retryable: true,
      cause: raw,
    })
  }

  // 5) Generic server errors (500, 502, 504)
  if (statusCode && statusCode >= 500) {
    return new CampaignGenerationError({
      stage,
      category: 'api_error',
      userMessage:
        'The AI service encountered a server error. Please try again in a moment.',
      retryable: true,
      cause: raw,
    })
  }

  // 6) Unknown
  return new CampaignGenerationError({
    stage,
    category: 'unknown',
    userMessage:
      'Something went wrong while generating your campaign. Please try again.',
    retryable: true,
    cause: raw,
  })
}
