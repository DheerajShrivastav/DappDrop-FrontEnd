'use client';

import React, { createContext, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useAccount, useDisconnect, useWalletClient } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useRole } from '@/hooks/use-role';
import { initializeProviderAndContract } from '@/lib/web3-service';
import type { Eip1193Provider } from 'ethers';

type Role = 'host' | 'participant' | null;

// Define ethereum provider interface with event methods
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
}

interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  role: Role;
  connectWallet: () => void;
  disconnectWallet: () => void;
  checkRoles: (address: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { role, checkRole } = useRole();
  const { data: walletClient } = useWalletClient();

  // Initialize web3-service with the Wagmi provider
  useEffect(() => {
    if (walletClient) {
      // walletClient.transport is not directly an Eip1193Provider, but for BrowserProvider it usually works 
      // if we pass the window.ethereum or similar. 
      // However, ethers.BrowserProvider expects an object with request method.
      // walletClient has a request method.
      initializeProviderAndContract(walletClient as unknown as Eip1193Provider);
    }
  }, [walletClient]);

  const connectWallet = useCallback(() => {
    if (openConnectModal) {
      openConnectModal();
    }
  }, [openConnectModal]);

  const disconnectWallet = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const checkRoles = useCallback(async (addr: string) => {
    await checkRole(addr);
  }, [checkRole]);

  const value = {
    isConnected,
    address: address || null,
    role,
    connectWallet,
    disconnectWallet,
    checkRoles
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
