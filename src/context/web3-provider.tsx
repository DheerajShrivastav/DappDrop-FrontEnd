'use client'

import '@rainbow-me/rainbowkit/styles.css'
import {
  getDefaultConfig,
  RainbowKitProvider,
  lightTheme,
} from '@rainbow-me/rainbowkit'
import { WagmiProvider, http } from 'wagmi'
import { mainnet, sepolia, base, polygon } from 'wagmi/chains'
import { defineChain, type Chain } from 'viem'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ReactNode } from 'react'
import appConfig from '@/app/config'

// Singleton pattern to prevent multiple WalletConnect initializations
// This can happen during React strict mode or hot module reloading
let wagmiConfig: ReturnType<typeof getDefaultConfig> | null = null
let queryClient: QueryClient | null = null

// Helper to determine the target chain dynamically
function getTargetChain() {
  if (appConfig.chainId === 11155111) return sepolia
  if (appConfig.chainId === 8453) return base
  if (appConfig.chainId === 1) return mainnet
  if (appConfig.chainId === 137) return polygon

  // Custom Virtual Testnet (Tenderly or other)
  return defineChain({
    id: appConfig.chainId,
    name: 'Custom Network',
    network: 'custom_network',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [appConfig.rpcUrl] },
      public: { http: [appConfig.rpcUrl] },
    },
  })
}

// Optional mainnet RPC (one that allows browser requests from this site). Only used for
// RainbowKit's ENS name/avatar lookups.
const MAINNET_RPC_URL = process.env.NEXT_PUBLIC_MAINNET_RPC_URL?.trim() || undefined

/**
 * Mainnet used to be in the list unconditionally, with no transport. Wagmi then used its public
 * default RPC (eth.merkle.io), which CORS-blocks this site — dozens of console errors per page.
 * It was only there for RainbowKit's ENS name/avatar lookups, which RainbowKit itself skips when
 * mainnet isn't configured (useIsMainnetConfigured; names then come from its own resolver). So:
 * include mainnet only when it's the target chain or a working RPC is configured for it.
 */
function getChains(): [Chain, ...Chain[]] {
  const target = getTargetChain()
  const chains: [Chain, ...Chain[]] = [target]
  if (target.id !== sepolia.id) chains.push(sepolia) // was listed twice when it's the target
  if (target.id !== mainnet.id && MAINNET_RPC_URL) chains.push(mainnet)
  return chains
}

function getConfig() {
  if (!wagmiConfig) {
    const chains = getChains()
    wagmiConfig = getDefaultConfig({
      appName: 'DApp Drop',
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
      chains,
      // Explicit per chain. Unchanged default for everything except mainnet, which gets the
      // configured RPC rather than the public one.
      transports: Object.fromEntries(
        chains.map((c) => [c.id, c.id === mainnet.id && MAINNET_RPC_URL ? http(MAINNET_RPC_URL) : http()]),
      ),
      ssr: true,
    })
  }
  return wagmiConfig
}

function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient()
  }
  return queryClient
}

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={getConfig()}>
      <QueryClientProvider client={getQueryClient()}>
        <RainbowKitProvider
          theme={lightTheme({
            accentColor: '#171717',
            accentColorForeground: '#ffffff',
            borderRadius: 'medium',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
