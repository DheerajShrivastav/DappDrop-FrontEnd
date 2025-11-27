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
 */
export async function verifyPaymentTransaction(
  txHash: string,
  expectedRecipient: string,
  expectedAmount: string,
  tokenAddress: string,
  network: string
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
      return { verified: false, error: 'Transaction not found or still pending' }
    }

    if (receipt.status !== 1) {
      return { verified: false, error: 'Transaction failed on blockchain' }
    }

    // Get transaction details
    const tx = await provider.getTransaction(txHash)
    if (!tx) {
      return { verified: false, error: 'Transaction details not found' }
    }

    // Check if native token (ETH/MATIC) or ERC-20
    const isNative = tokenAddress === '0x0' || tokenAddress === ethers.ZeroAddress

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

      // Find Transfer event in transaction logs
      const transferLog = receipt.logs.find((log) => {
        if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) return false
        try {
          const parsed = erc20Interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          })
          return parsed?.name === 'Transfer'
        } catch {
          return false
        }
      })

      if (!transferLog) {
        return { verified: false, error: 'No Transfer event found in transaction' }
      }

      const parsed = erc20Interface.parseLog({
        topics: transferLog.topics as string[],
        data: transferLog.data,
      })

      if (!parsed) {
        return { verified: false, error: 'Failed to parse Transfer event' }
      }

      const [from, to, value] = parsed.args
      
      if (to.toLowerCase() !== expectedRecipient.toLowerCase()) {
        return {
          verified: false,
          error: `Wrong recipient: expected ${expectedRecipient}, got ${to}`,
        }
      }

      if (value.toString() !== expectedAmount) {
        return {
          verified: false,
          error: `Wrong amount: expected ${expectedAmount}, got ${value.toString()}`,
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
