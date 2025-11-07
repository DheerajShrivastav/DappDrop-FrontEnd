// src/lib/validation-utils.ts

/**
 * Validate Ethereum wallet address format
 * @param address - The wallet address to validate
 * @returns true if valid, false otherwise
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Validate and sanitize wallet address
 * @param address - The wallet address to validate
 * @throws Error if address is invalid
 * @returns Lowercase address
 */
export function validateWalletAddress(address: string): string {
  if (!address) {
    throw new Error('Wallet address is required')
  }
  
  if (!isValidEthereumAddress(address)) {
    throw new Error('Invalid wallet address format')
  }
  
  return address.toLowerCase()
}
