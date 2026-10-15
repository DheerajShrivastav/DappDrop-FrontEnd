import { analyticsDomain } from '@/config/landing'
import { claimsVersion, launchStage } from '@/config/claims'
import { TrackListener } from './track-listener'

/** First-party paths, rewritten to Plausible in next.config.ts (only when analytics is on). */
export const PLAUSIBLE_SCRIPT_PATH = '/js/pl.js'
export const PLAUSIBLE_EVENT_PATH = '/api/event'

/**
 * QW-07: cookieless analytics, OFF unless NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set at build time.
 * A plain <script defer> (not next/script), plus a queue stub so events fired before the
 * script loads aren't lost. Renders nothing at all when analytics is off.
 */
export function Analytics() {
  if (!analyticsDomain) return null
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: 'window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}',
        }}
      />
      <script defer data-domain={analyticsDomain} data-api={PLAUSIBLE_EVENT_PATH} src={PLAUSIBLE_SCRIPT_PATH} />
      <TrackListener claimsVersion={claimsVersion} launchStage={launchStage} />
    </>
  )
}
