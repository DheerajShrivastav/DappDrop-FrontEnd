/**
 * The participant side of a payment task (ONCHAIN_TX): send the payment from the connected wallet,
 * then have /api/tasks/verify-payment check it and sign the completion attestation. ethers stays
 * in lib/ (CLAUDE.md); the dialog only calls these.
 */
import { ethers } from 'ethers'
import { getWalletBrowserProvider } from '@/lib/web3-service'
import { isNativePaymentToken, toBaseUnits } from '@/lib/payment-verification'
import type { PaymentRequest } from '@/lib/payment-request'

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
]

/** The wallet is on another network; the dialog offers a switch. */
export class WrongNetworkError extends Error {
  constructor(public readonly chainId: number) {
    super('Your wallet is on a different network.')
    this.name = 'WrongNetworkError'
  }
}

/**
 * Send the payment and wait for one confirmation. `onSent` fires with the hash as soon as the
 * wallet broadcasts, so the caller can remember it before the (slow) confirmation: if the page
 * closes now, a retry re-checks this transaction instead of paying again.
 */
export async function sendTaskPayment(req: PaymentRequest, onSent?: (hash: string) => void): Promise<string> {
  const provider = getWalletBrowserProvider()
  if (!provider) throw new Error('Connect your wallet first.')
  const network = await provider.getNetwork()
  if (Number(network.chainId) !== req.chainId) throw new WrongNetworkError(req.chainId)

  const signer = await provider.getSigner()
  const from = await signer.getAddress()

  let tx: ethers.TransactionResponse
  if (isNativePaymentToken(req.tokenAddress)) {
    const value = toBaseUnits(req.amount, 18)
    if (value === null) throw new Error('This task’s payment amount is not set up correctly.')
    if ((await provider.getBalance(from)) < value) {
      throw new Error(`This wallet doesn’t have ${req.amountDisplay}, plus a little for the network fee.`)
    }
    tx = await signer.sendTransaction({ to: req.recipient, value })
  } else {
    const token = new ethers.Contract(req.tokenAddress as string, ERC20_ABI, signer)
    const decimals = Number(await token.decimals())
    const value = toBaseUnits(req.amount, decimals)
    if (value === null) throw new Error('This task’s payment amount is not set up correctly.')
    if ((await token.balanceOf(from)) < value) {
      throw new Error(`This wallet doesn’t have ${req.amountDisplay}.`)
    }
    tx = await token.transfer(req.recipient, value)
  }

  onSent?.(tx.hash)
  const receipt = await tx.wait()
  if (!receipt || receipt.status !== 1) throw new Error('The payment transaction failed on-chain.')
  return tx.hash
}

/** /api/tasks/verify-payment's success body (attestAndRespond's shape). */
export type PaymentVerifyResult = {
  success: true
  verified: true
  attested?: boolean
  submitted?: boolean
  attestation?: {
    participant: string
    taskIndex: number
    completed: boolean
    deadline: number
    signature: string
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Ask the server to check the payment and attest the task. The server reads the chain through
 * its own RPC, which can be a few seconds behind the wallet's, so "not found or still pending"
 * is retried a few times before it's shown.
 */
export async function verifyTaskPayment(
  campaignId: string,
  taskIndex: number,
  transactionHash: string,
  userAddress: string,
  { attempts = 4, delayMs = 4000 }: { attempts?: number; delayMs?: number } = {},
): Promise<PaymentVerifyResult> {
  for (let i = 0; ; i++) {
    const res = await fetch('/api/tasks/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: Number(campaignId), taskIndex, transactionHash, userAddress }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok && body.success && body.verified) return body as PaymentVerifyResult
    const message: string = body.message || body.error || 'The payment couldn’t be checked.'
    if (i < attempts - 1 && /not found or still pending/i.test(message)) {
      await sleep(delayMs)
      continue
    }
    throw new Error(message)
  }
}
