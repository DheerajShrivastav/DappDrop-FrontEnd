import { BrowserProvider } from 'ethers'

/**
 * Sign an authentication message with the user's wallet
 *
 * @param provider - Ethers browser provider
 * @returns Object containing signature, message, and address
 */
export async function signAuthMessage(provider: BrowserProvider) {
  const signer = await provider.getSigner()
  const address = await signer.getAddress()
  const nonce = Date.now().toString()

  const message = `Sign this message to authenticate with DappDrop\n\nWallet: ${address}\nNonce: ${nonce}`

  const signature = await signer.signMessage(message)

  return {
    signature,
    message,
    address,
  }
}
