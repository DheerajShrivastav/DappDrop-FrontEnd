/**
 * The chain this deployment runs on (NEXT_PUBLIC_CHAIN_ID), in the shapes the UI needs.
 * Payment tasks are locked to it: a Sepolia app must not ask participants to pay on mainnet.
 *
 * `network` is the key payment verification uses (NETWORK_RPC in payment-verification.ts),
 * so a task saved with it verifies against the right RPC.
 */
import config from '@/app/config'

export type DeploymentChain = {
  id: number
  /** Payment-verification network key, e.g. 'sepolia'. */
  network: string
  /** Display name, e.g. 'Sepolia (testnet)'. */
  name: string
  /** Native gas token symbol. */
  gasSymbol: string
  isTestnet: boolean
}

const KNOWN: Record<number, Omit<DeploymentChain, 'id'>> = {
  11155111: { network: 'sepolia', name: 'Sepolia (testnet)', gasSymbol: 'Sepolia ETH', isTestnet: true },
  1: { network: 'ethereum', name: 'Ethereum', gasSymbol: 'ETH', isTestnet: false },
  8453: { network: 'base', name: 'Base', gasSymbol: 'ETH', isTestnet: false },
  137: { network: 'polygon', name: 'Polygon', gasSymbol: 'POL', isTestnet: false },
}

export function deploymentChainFor(chainId: number): DeploymentChain {
  const known = KNOWN[chainId]
  if (known) return { id: chainId, ...known }
  return {
    id: chainId,
    network: `chain-${chainId}`,
    name: `Chain ${chainId}`,
    gasSymbol: 'ETH',
    isTestnet: false,
  }
}

export const DEPLOYMENT_CHAIN: DeploymentChain = deploymentChainFor(config.chainId)
