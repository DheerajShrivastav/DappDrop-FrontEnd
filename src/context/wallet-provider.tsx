
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { connectWallet as web3Connect, isSuperAdmin as web3IsSuperAdmin } from '@/lib/web3-service';

type Role = 'host' | 'participant';

interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  role: Role;
  isSuperAdmin: boolean;
  connectWallet: () => void;
  disconnectWallet: () => void;
  toggleRole: () => void;
  setRole: (role: Role) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('participant');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const checkAdminRole = useCallback(async (currentAddress: string) => {
      const isAdmin = await web3IsSuperAdmin(currentAddress);
      setIsSuperAdmin(isAdmin);
  }, []);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setIsConnected(false);
    setIsSuperAdmin(false);
    // You might want to clear other states or local storage here if needed
  }, []);

  const handleAccountsChanged = useCallback(async (accounts: string[]) => {
    if (accounts.length === 0) {
      // MetaMask is locked or the user has disconnected all accounts.
      disconnectWallet();
    } else if (accounts[0] !== address) {
      const newAddress = accounts[0];
      setAddress(newAddress);
      setIsConnected(true);
      await checkAdminRole(newAddress);
    }
  }, [address, checkAdminRole, disconnectWallet]);

  const connectWallet = useCallback(async () => {
    const account = await web3Connect();
    if(account) {
        setAddress(account);
        setIsConnected(true);
        await checkAdminRole(account);
    } else {
        disconnectWallet();
    }
  }, [checkAdminRole, disconnectWallet]);

  const toggleRole = useCallback(() => {
    setRole((prevRole) => (prevRole === 'host' ? 'participant' : 'host'));
  }, []);

  useEffect(() => {
    if (typeof window.ethereum === 'undefined') {
      return;
    }

    const checkInitialConnection = async () => {
        try {
            const accounts = await window.ethereum!.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                const newAddress = accounts[0];
                setAddress(newAddress);
                setIsConnected(true);
                await checkAdminRole(newAddress);
            }
        } catch (error) {
            console.error("Error checking for initial wallet connection:", error);
        }
    };
    
    checkInitialConnection();

    window.ethereum.on('accountsChanged', handleAccountsChanged);

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [handleAccountsChanged, checkAdminRole]);


  const value = { isConnected, address, role, isSuperAdmin, connectWallet, disconnectWallet, toggleRole, setRole };

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
