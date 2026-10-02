import { ethers } from 'ethers'

const NETWORK_RPC: Record<string, string> = {
  sepolia: 'https://ethereum-sepolia.publicnode.com',
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
  polygon: 'https://polygon-rpc.com',
}

export interface PaymentVerificationResult {
  verified: boolean
  error?: string
}

/**
 * Verify a payment transaction on the blockchain
 * Similar to verifying an ONCHAIN_TX task
 *
 * `expectedSender` is the participant claiming the payment (the SIWE session wallet). The payment
 * must come FROM them: tx.from for native payments, and for ERC-20 both tx.from and the matching
 * Transfer's `from`. Without this, anyone could submit someone else's payment hash first and take
 * the credit (transactionHash is unique, so the real payer would then be locked out).
 */
export async function verifyPaymentTransaction(
  txHash: string,
  expectedRecipient: string,
  expectedAmount: string,
  tokenAddress: string,
  network: string,
  expectedSender: string,
): Promise<PaymentVerificationResult> {
  const rpcUrl = NETWORK_RPC[network]
  if (!rpcUrl) {
    return { verified: false, error: `Unsupported network: ${network}` }
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    console.log('🔍 Verifying payment transaction:', {
      txHash,
      network,
      expectedRecipient,
      expectedAmount,
      tokenAddress,
    })

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) {
      return {
        verified: false,
        error: 'Transaction not found or still pending',
      }
    }

    if (receipt.status !== 1) {
      return { verified: false, error: 'Transaction failed on blockchain' }
    }

    // Get transaction details
    const tx = await provider.getTransaction(txHash)
    if (!tx) {
      return { verified: false, error: 'Transaction details not found' }
    }

    const sender = expectedSender.toLowerCase()
    if (tx.from.toLowerCase() !== sender) {
      return {
        verified: false,
        error: 'This payment was sent from a different wallet. Submit a payment sent from your connected wallet.',
      }
    }

    // Check if native token (ETH/MATIC) or ERC-20
    const isNative =
      tokenAddress === '0x0' || tokenAddress === ethers.ZeroAddress

    if (isNative) {
      // Verify native token payment (ETH, MATIC, etc.)
      console.log('💰 Verifying native token payment')

      if (tx.to?.toLowerCase() !== expectedRecipient.toLowerCase()) {
        return {
          verified: false,
          error: `Wrong recipient: expected ${expectedRecipient}, got ${tx.to}`,
        }
      }

      if (tx.value.toString() !== expectedAmount) {
        return {
          verified: false,
          error: `Wrong amount: expected ${expectedAmount} wei, got ${tx.value.toString()} wei`,
        }
      }

      console.log('✅ Native token payment verified')
      return { verified: true }
    } else {
      // Verify ERC-20 token payment
      console.log('🪙 Verifying ERC-20 token payment')

      const erc20Interface = new ethers.Interface([
        'event Transfer(address indexed from, address indexed to, uint256 value)',
      ])

      // Every Transfer of this token in the tx; then look for the one that IS the payment. Taking
      // the first Transfer log (as before) could pick an unrelated transfer in a multi-step tx.
      const transfers = receipt.logs
        .filter((log) => log.address.toLowerCase() === tokenAddress.toLowerCase())
        .map((log) => {
          try {
            const parsed = erc20Interface.parseLog({ topics: log.topics as string[], data: log.data })
            if (parsed?.name !== 'Transfer') return null
            const [from, to, value] = parsed.args
            return { from: String(from).toLowerCase(), to: String(to).toLowerCase(), value: value.toString() }
          } catch {
            return null
          }
        })
        .filter((t): t is { from: string; to: string; value: string } => t !== null)

      if (transfers.length === 0) {
        return {
          verified: false,
          error: 'No Transfer event found in transaction',
        }
      }

      const recipient = expectedRecipient.toLowerCase()
      const match = transfers.find(
        (t) => t.from === sender && t.to === recipient && t.value === expectedAmount,
      )
      if (!match) {
        const toRecipient = transfers.filter((t) => t.to === recipient)
        if (toRecipient.length === 0) {
          return { verified: false, error: `Wrong recipient: expected ${expectedRecipient}` }
        }
        if (!toRecipient.some((t) => t.from === sender)) {
          return {
            verified: false,
            error: 'This payment was sent from a different wallet. Submit a payment sent from your connected wallet.',
          }
        }
        return {
          verified: false,
          error: `Wrong amount: expected ${expectedAmount}, got ${toRecipient.map((t) => t.value).join(', ')}`,
        }
      }

      console.log('✅ ERC-20 token payment verified')
      return { verified: true }
    }
  } catch (error) {
    console.error('❌ Payment verification error:', error)
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    }
  }
}

/**
 * Parse payment metadata from task metadata JSON
 */
export interface PaymentInfo {
  paymentRequired: boolean
  paymentRecipient: string
  chainId: number
  network: string
  tokenAddress: string
  tokenSymbol: string
  amount: string
  amountDisplay: string
}

export function parsePaymentInfo(metadata: any): PaymentInfo | null {
  if (!metadata || typeof metadata !== 'object') {
    return null
  }

  if (!metadata.paymentRequired) {
    return null
  }

  return {
    paymentRequired: metadata.paymentRequired,
    paymentRecipient: metadata.paymentRecipient,
    chainId: metadata.chainId,
    network: metadata.network,
    tokenAddress: metadata.tokenAddress,
    tokenSymbol: metadata.tokenSymbol,
    amount: metadata.amount,
    amountDisplay: metadata.amountDisplay,
  }
}
