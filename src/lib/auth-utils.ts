import { ethers } from 'ethers'

/**
 * Verify a wallet signature and recover the signer's address
 * This implements server-side signature verification for authentication
 *
 * @param signature - The signature from the wallet
 * @param message - The original message that was signed
 * @returns The recovered Ethereum address or null if verification fails
 */
export async function verifyAuthentication(
  signature: string,
  message: string
): Promise<string | null> {
  try {
    // Verify the signature and recover the address
    const recoveredAddress = ethers.verifyMessage(message, signature)

    console.log('✅ Signature verified, recovered address:', recoveredAddress)

    return recoveredAddress
  } catch (error) {
    console.error('❌ Signature verification failed:', error)
    return null
  }
}

/**
 * Generate a standard authentication message for SIWE-like authentication
 * This should match the format used on the client side
 *
 * @param address - The wallet address
 * @param nonce - A unique nonce (timestamp or random string)
 * @returns Formatted message string
 */
export function generateAuthMessage(address: string, nonce: string): string {
  return `Sign this message to authenticate with DappDrop\n\nWallet: ${address}\nNonce: ${nonce}`
}

/**
 * Validate that a message matches the expected format and is recent
 *
 * @param message - The message to validate
 * @param maxAge - Maximum age in milliseconds (default: 5 minutes)
 * @returns true if valid, false otherwise
 */
export function validateAuthMessage(
  message: string,
  maxAge: number = 5 * 60 * 1000
): boolean {
  try {
    // Extract nonce from message
    const nonceMatch = message.match(/Nonce: (\d+)/)
    if (!nonceMatch) {
      console.error('❌ Message validation failed: No nonce found')
      return false
    }

    const nonce = parseInt(nonceMatch[1], 10)
    const now = Date.now()

    // Check if the nonce (timestamp) is within the allowed age
    if (now - nonce > maxAge) {
      console.error('❌ Message validation failed: Message too old')
      return false
    }

    return true
  } catch (error) {
    console.error('❌ Message validation error:', error)
    return false
  }
}
