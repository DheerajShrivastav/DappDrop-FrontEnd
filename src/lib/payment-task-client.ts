import { BrowserProvider, ethers } from 'ethers'

export interface PaymentTaskInfo {
  recipient: string
  amount: string
  amountDisplay: string
  token: string
  tokenAddress: string
  network: string
  chainId: number
}

/**
 * Check if a task requires payment
 */
export async function checkPaymentTaskStatus(
  campaignId: number,
  taskIndex: number,
  userAddress: string
) {
  const response = await fetch(
    `/api/tasks/check-payment?campaignId=${campaignId}&taskIndex=${taskIndex}&userAddress=${userAddress}`
  )

  if (!response.ok) {
    throw new Error('Failed to check payment status')
  }

  return response.json()
}

/**
 * Send payment transaction for a task
 * Supports both native tokens (ETH) and ERC-20 tokens
 */
export async function sendPaymentTransaction(
  provider: BrowserProvider,
  paymentInfo: PaymentTaskInfo
): Promise<string> {
  const signer = await provider.getSigner()
  const userAddress = await signer.getAddress()

  const network = await provider.getNetwork()
  if (Number(network.chainId) !== Number(paymentInfo.chainId)) {
    throw new Error(`Wrong network. Please switch to chain ID ${paymentInfo.chainId}`)
  }

  console.log('💳 Sending payment:', {
    from: userAddress,
    to: paymentInfo.recipient,
    amount: paymentInfo.amountDisplay,
    token: paymentInfo.token,
  })

  // Check if it's a native token payment (ETH, MATIC, etc.)
  const isNative =
    paymentInfo.tokenAddress === '0x0' ||
    paymentInfo.tokenAddress === ethers.ZeroAddress

  if (isNative) {
    // Send native token
    console.log('💰 Sending native token payment')
    const tx = await signer.sendTransaction({
      to: paymentInfo.recipient,
      value: paymentInfo.amount,
    })

    console.log('📤 Transaction sent:', tx.hash)
    await tx.wait()
    console.log('✅ Transaction confirmed:', tx.hash)

    return tx.hash
  } else {
    // Send ERC-20 token
    console.log('🪙 Sending ERC-20 token payment')

    const erc20Abi = [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ]

    const tokenContract = new ethers.Contract(
      paymentInfo.tokenAddress,
      erc20Abi,
      signer
    )

    // Check balance
    const balance = await tokenContract.balanceOf(userAddress)
    if (balance < BigInt(paymentInfo.amount)) {
      throw new Error(
        `Insufficient ${paymentInfo.token} balance. Required: ${paymentInfo.amountDisplay}`
      )
    }

    // Send transfer transaction
    const tx = await tokenContract.transfer(
      paymentInfo.recipient,
      paymentInfo.amount
    )
    console.log('📤 Transaction sent:', tx.hash)

    await tx.wait()
    console.log('✅ Transaction confirmed:', tx.hash)

    return tx.hash
  }
}

/**
 * Verify a payment transaction with the server
 */
export async function verifyPaymentTransaction(
  campaignId: number,
  taskIndex: number,
  transactionHash: string,
  userAddress: string
): Promise<boolean> {
  console.log('🔍 Verifying payment transaction:', transactionHash)

  const response = await fetch('/api/tasks/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignId,
      taskIndex,
      transactionHash,
      userAddress,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Payment verification failed')
  }

  const data = await response.json()
  console.log('✅ Payment verified:', data)

  return data.verified
}

/**
 * Complete payment task flow
 * 1. Check if payment is required
 * 2. Send payment transaction
 * 3. Verify with server
 */
export async function completePaymentTask(
  provider: BrowserProvider,
  campaignId: number,
  taskIndex: number
): Promise<string> {
  const signer = await provider.getSigner()
  const userAddress = await signer.getAddress()

  // Check payment requirements
  const status = await checkPaymentTaskStatus(
    campaignId,
    taskIndex,
    userAddress
  )

  if (!status.paymentRequired) {
    throw new Error('This task does not require payment')
  }

  if (status.verified) {
    console.log('✅ Payment already completed')
    return status.transactionHash
  }

  if (!status.paymentInfo) {
    throw new Error('Payment information not found')
  }

  // Send payment
  const txHash = await sendPaymentTransaction(provider, {
    recipient: status.paymentInfo.recipient,
    amount: status.paymentInfo.amount, // This will be fetched from metadata (in Wei)
    amountDisplay: status.paymentInfo.amount,
    token: status.paymentInfo.token,
    tokenAddress: status.paymentInfo.tokenAddress || '0x0',
    network: status.paymentInfo.network,
    chainId: status.paymentInfo.chainId,
  })

  // Verify with server
  await verifyPaymentTransaction(campaignId, taskIndex, txHash, userAddress)

  return txHash
}
