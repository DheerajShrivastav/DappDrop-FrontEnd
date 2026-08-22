'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from 'react'
import { useAccount, useDisconnect, useWalletClient } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import type { Eip1193Provider } from 'ethers'
import { useRole } from '@/hooks/use-role'
import { initializeProviderAndContract, getWalletBrowserProvider } from '@/lib/web3-service'
import { getSession, signInWithEthereum, signOut as siweSignOut } from '@/lib/wallet-auth'
import { useToast } from '@/hooks/use-toast'

type Role = 'host' | 'participant' | null

// Define ethereum provider interface with event methods
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on: (event: string, callback: (...args: unknown[]) => void) => void
  removeListener?: (
    event: string,
    callback: (...args: unknown[]) => void,
  ) => void
}

interface WalletContextType {
  isConnected: boolean
  address: string | null
  role: Role
  connectWallet: () => void
  disconnectWallet: () => void
  checkRoles: (address: string) => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()
  const { role, checkRole } = useRole()
  const { data: walletClient } = useWalletClient()
  const { toast } = useToast()
  const lastWalletClientRef = useRef<typeof walletClient | null>(null)
  // Tracks the address we've already established (or are establishing) a SIWE session for,
  // so reconnecting to the same wallet / re-renders don't re-prompt a signature every time.
  const siweAddressRef = useRef<string | null>(null)

  // Initialize web3-service with the Wagmi provider
  useEffect(() => {
    if (walletClient && walletClient !== lastWalletClientRef.current) {
      // walletClient.transport is not directly an Eip1193Provider, but for BrowserProvider it usually works
      // if we pass the window.ethereum or similar.
      // However, ethers.BrowserProvider expects an object with request method.
      // walletClient has a request method.
      initializeProviderAndContract(walletClient as unknown as Eip1193Provider)
      lastWalletClientRef.current = walletClient
    }
  }, [walletClient])

  // Establish a real server session (SIWE) once a wallet is connected — connecting a wallet
  // via RainbowKit alone only proves control client-side; every session-gated page/route
  // (verifyWalletSession) needs the siwe-session cookie this creates. Skips re-signing if a
  // valid session for this exact address already exists (e.g. cookie survived a page reload).
  useEffect(() => {
    if (!walletClient || !address || !isConnected) return
    if (siweAddressRef.current === address) return
    siweAddressRef.current = address

    let cancelled = false
    ;(async () => {
      try {
        const existing = await getSession()
        if (cancelled) return
        if (existing && existing.toLowerCase() === address.toLowerCase()) return

        // Reuses the provider web3-service already built from this same walletClient in the
        // effect above (they share the [walletClient] dependency, so it is initialized by now).
        const browserProvider = getWalletBrowserProvider()
        if (!browserProvider) throw new Error('Wallet provider is not initialized yet.')
        await signInWithEthereum(browserProvider)
      } catch (error) {
        if (cancelled) return
        siweAddressRef.current = null // allow retry on next render/reconnect
        toast({
          variant: 'destructive',
          title: 'Sign-in failed',
          description:
            error instanceof Error ? error.message : 'Could not verify wallet ownership with the server.',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [walletClient, address, isConnected, toast])

  const connectWallet = useCallback(() => {
    if (openConnectModal) {
      openConnectModal()
    }
  }, [openConnectModal])

  const disconnectWallet = useCallback(() => {
    siweAddressRef.current = null
    siweSignOut().catch(() => {
      // best-effort — the client-side disconnect below is what actually matters to the user
    })
    disconnect()
  }, [disconnect])

  const checkRoles = useCallback(
    async (addr: string) => {
      await checkRole(addr)
    },
    [checkRole],
  )

  const value = {
    isConnected,
    address: address || null,
    role,
    connectWallet,
    disconnectWallet,
    checkRoles,
  }

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  )
}

export const useWallet = () => {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
