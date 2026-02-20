'use client'

import '@rainbow-me/rainbowkit/styles.css'
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ReactNode } from 'react'

// Singleton pattern to prevent multiple WalletConnect initializations
// This can happen during React strict mode or hot module reloading
let config: ReturnType<typeof getDefaultConfig> | null = null
let queryClient: QueryClient | null = null

function getConfig() {
  if (!config) {
    config = getDefaultConfig({
      appName: 'DApp Drop',
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
      chains: [mainnet, sepolia],
      ssr: true,
    })
  }
  return config
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
