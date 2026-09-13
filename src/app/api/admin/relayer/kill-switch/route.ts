import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireAdminRole } from '@/lib/admin-auth'
import { setKillSwitch } from '@/lib/relayer-gates'

/**
 * POST /api/admin/relayer/kill-switch — surfaces worker/relayer.ts's `--kill`/`--resume` CLI
 * flags as a UI toggle (P3 CP4). Same underlying DB-backed RelayerControl row the worker
 * already checks every tick — no new mechanism, just a second way to flip it besides SSH+CLI.
 * Gated DEFAULT_ADMIN. Self-claim is completely unaffected either way (see relayer-gates.ts).
 */
export async function POST(request: Request) {
  let walletAddress: string
  try {
    ;({ walletAddress } = await verifyWalletSession())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    await requireAdminRole(walletAddress, 'DEFAULT_ADMIN')
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const enabled = Boolean(body?.enabled)
  const reason = typeof body?.reason === 'string' ? body.reason : undefined

  if (enabled && !reason) {
    return NextResponse.json({ error: 'A reason is required to enable the kill switch' }, { status: 400 })
  }

  await setKillSwitch(enabled, enabled ? reason : undefined)
  return NextResponse.json({ success: true, enabled, reason })
}
