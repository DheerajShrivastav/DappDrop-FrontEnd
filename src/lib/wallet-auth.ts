import { BrowserProvider } from 'ethers'
import { createSiweMessage } from 'viem/siwe'

/**
 * Sign-In With Ethereum (EIP-4361) client flow (FR-W3/W4). Fetches a server-issued nonce,
 * builds a proper SIWE message, has the wallet sign it, and posts it to the verify endpoint
 * which opens the backend session. Browsing needs no wallet — this runs only when a user
 * chooses to participate/host (P1).
 */
export async function signInWithEthereum(
  provider: BrowserProvider,
): Promise<{ address: string }> {
  const signer = await provider.getSigner()
  const address = await signer.getAddress()
  const network = await provider.getNetwork()

  // 1. Server-issued single-use nonce.
  const nonceRes = await fetch('/api/auth/nonce', { credentials: 'include' })
  if (!nonceRes.ok) throw new Error('Could not obtain a sign-in nonce')
  const { nonce } = (await nonceRes.json()) as { nonce: string }

  // 2. Build the EIP-4361 message. `domain`/`uri` come from the live origin so they match
  //    what the server validates against.
  const message = createSiweMessage({
    address: address as `0x${string}`,
    chainId: Number(network.chainId),
    domain: window.location.host,
    uri: window.location.origin,
    nonce,
    version: '1',
    statement: 'Sign in to DappDrop.',
  })

  // 3. Wallet signs; 4. server verifies + sets the session cookie.
  const signature = await signer.signMessage(message)
  const verifyRes = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ message, signature }),
  })
  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({}))
    throw new Error(err.error || 'Sign-in verification failed')
  }
  return (await verifyRes.json()) as { address: string }
}

/** Clear the SIWE session. */
export async function signOut(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}

/** Current SIWE session address, or null. */
export async function getSession(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' })
    if (!res.ok) return null
    const { address } = (await res.json()) as { address: string | null }
    return address
  } catch {
    return null
  }
}

/**
 * @deprecated Legacy per-request signature auth (homegrown timestamp nonce). Still used by
 * the image-upload / uploadthing-cleanup routes, which authenticate each write with a fresh
 * signature rather than a session. TODO(P1): migrate those routes to the SIWE session above
 * and delete this together with lib/auth-utils.ts.
 */
export async function signAuthMessage(provider: BrowserProvider) {
  const signer = await provider.getSigner()
  const address = await signer.getAddress()
  const nonce = Date.now().toString()
  const message = `Sign this message to authenticate with DappDrop\n\nWallet: ${address}\nNonce: ${nonce}`
  const signature = await signer.signMessage(message)
  return { signature, message, address }
}
