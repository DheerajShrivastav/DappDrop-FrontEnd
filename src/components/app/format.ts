/**
 * Display helpers shared by the app primitives (server-safe, no React).
 *
 * Addresses are ALWAYS truncated in the UI (app-design §1.3, no horizontal scroll from 320 px):
 * put the full value in `title` and next to a copy button.
 */

/** `0x3f9c…a1e2` (long, the default) or `0x3f…e2` (short: the phone account pill). */
export function shortAddress(address: string | null | undefined, size: 'long' | 'short' = 'long'): string {
  if (!address) return ''
  const [head, tail] = size === 'short' ? [4, 2] : [6, 4]
  if (address.length <= head + tail + 1) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

/** "1 participant" / "3 participants" (copy rules: plurals done properly). */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}
