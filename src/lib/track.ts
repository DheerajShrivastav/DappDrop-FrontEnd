/**
 * QW-07: the landing page's only analytics call. Cookieless Plausible, proxied first-party.
 *
 * - A no-op unless the Plausible script is on the page (it is only when
 *   NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set at build time).
 * - Every event carries `claims_version` and `launch_stage` (set once by <TrackListener>).
 * - Never pass wallet addresses, emails or any user identifier here.
 */
export type TrackProps = Record<string, string | number | boolean>

declare global {
  interface Window {
    plausible?: ((event: string, options?: { props?: TrackProps }) => void) & { q?: unknown[] }
  }
}

let context: TrackProps = {}

export function setTrackContext(props: TrackProps): void {
  context = props
}

export function track(event: string, props: TrackProps = {}): void {
  try {
    window.plausible?.(event, { props: { ...context, ...props } })
  } catch {
    // Analytics must never break the page.
  }
}
