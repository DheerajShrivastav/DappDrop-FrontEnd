import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { recoverMessageAddress } from 'viem'
import { parseSiweMessage, validateSiweMessage } from 'viem/siwe'
import { prisma } from '@/lib/prisma'
import {
  activeChainId,
  createSessionToken,
  NONCE_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  siweDomainAndUri,
} from '@/lib/siwe'

// POST /api/auth/verify — verify a signed EIP-4361 message and open a session (FR-W3/W4).
// Body: { message: string, signature: `0x${string}` }
export async function POST(request: Request) {
  let body: { message?: string; signature?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { message, signature } = body
  if (!message || !signature) {
    return NextResponse.json(
      { error: 'message and signature are required' },
      { status: 400 },
    )
  }

  const cookieStore = await cookies()
  const expectedNonce = cookieStore.get(NONCE_COOKIE)?.value
  if (!expectedNonce) {
    return NextResponse.json(
      { error: 'No active nonce — request a nonce first' },
      { status: 400 },
    )
  }

  const { domain } = siweDomainAndUri()
  const parsed = parseSiweMessage(message)

  // Validate the message fields against what we expect: our domain, the issued nonce, the
  // active chain, and time bounds. This is the CSRF + replay guard (single-use nonce below).
  const fieldsValid = validateSiweMessage({
    message: parsed,
    domain,
    nonce: expectedNonce,
    time: new Date(),
  })
  if (!fieldsValid || !parsed.address) {
    return NextResponse.json(
      { error: 'SIWE message failed validation (domain/nonce/expiry)' },
      { status: 401 },
    )
  }
  if (parsed.chainId !== undefined && parsed.chainId !== activeChainId()) {
    return NextResponse.json(
      { error: 'SIWE message is for the wrong chain' },
      { status: 401 },
    )
  }

  // Verify the signature actually came from the claimed address (EOA ECDSA recovery).
  // TODO(P1): support ERC-1271 smart-account signatures via a viem public client.
  let recovered: string
  try {
    recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    })
  } catch {
    return NextResponse.json({ error: 'Malformed signature' }, { status: 401 })
  }
  if (recovered.toLowerCase() !== parsed.address.toLowerCase()) {
    return NextResponse.json(
      { error: 'Signature does not match the message address' },
      { status: 401 },
    )
  }

  const address = parsed.address.toLowerCase()

  // Consume the nonce (single-use) before opening the session.
  cookieStore.delete(NONCE_COOKIE)

  // One wallet ⇄ one backend account. Off-chain accounts + humanity status attach here.
  try {
    await prisma.user.upsert({
      where: { walletAddress: address },
      update: {},
      create: { walletAddress: address },
    })
  } catch (e) {
    // Auth still succeeds if the row exists / DB hiccups on a benign upsert; log and continue.
    console.warn('[auth/verify] user upsert warning:', e)
  }

  cookieStore.set(SESSION_COOKIE, createSessionToken(address), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })

  return NextResponse.json({ address }, { headers: { 'Cache-Control': 'no-store' } })
}
