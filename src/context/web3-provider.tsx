'use client'

import '@rainbow-me/rainbowkit/styles.css'
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { mainnet, sepolia, base, polygon } from 'wagmi/chains'
import { defineChain } from 'viem'
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

function getConfig() {
  if (!wagmiConfig) {
    wagmiConfig = getDefaultConfig({
      appName: 'DApp Drop',
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
      chains: [getTargetChain(), mainnet, sepolia],
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
        <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
