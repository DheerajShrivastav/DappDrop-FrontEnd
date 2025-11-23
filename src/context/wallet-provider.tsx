
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { connectWallet as web3Connect, isHost as web3IsHost } from '@/lib/web3-service';

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
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(null);

  const checkRoles = useCallback(async (currentAddress: string) => {
      const isHost = await web3IsHost(currentAddress);
      setRole(isHost ? 'host' : 'participant');
  }, []);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setIsConnected(false);
    setRole(null);
  }, []);
  
  const connectWallet = useCallback(async () => {
    const account = await web3Connect();
    if(account) {
        setAddress(account);
        setIsConnected(true);
        await checkRoles(account);
    } else {
        disconnectWallet();
    }
  }, [checkRoles, disconnectWallet]);
  
  const handleAccountsChanged = useCallback(async (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else if (accounts[0] !== address) {
      await connectWallet();
    }
  }, [address, connectWallet, disconnectWallet]);

  useEffect(() => {
    if (typeof window.ethereum === 'undefined') {
      return;
    }
    
    // Type assertion for ethereum event listeners
    const ethereum = window.ethereum as unknown as EthereumProvider;
    
    // Wrapper to handle the type conversion from unknown[] to string[]
    const accountsChangedHandler = (...args: unknown[]) => {
      handleAccountsChanged(args[0] as string[]);
    };
    
    ethereum.on('accountsChanged', accountsChangedHandler);

    return () => {
      if (ethereum?.removeListener) {
        ethereum.removeListener('accountsChanged', accountsChangedHandler);
      }
    };
  }, [handleAccountsChanged]);


  const value = { isConnected, address, role, connectWallet, disconnectWallet, checkRoles };

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
