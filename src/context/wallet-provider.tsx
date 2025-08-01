'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { connectWallet as web3Connect, getAllCampaigns } from '@/lib/web3-service';

type Role = 'host' | 'participant';

interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  role: Role;
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

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      console.log('Please connect to MetaMask.');
      disconnectWallet();
    } else if (accounts[0] !== address) {
      setAddress(accounts[0]);
      setIsConnected(true);
    }
  };

  const connectWallet = useCallback(async () => {
    const account = await web3Connect();
    if(account) {
        setAddress(account);
        setIsConnected(true);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setIsConnected(false);
  }, []);

  const toggleRole = useCallback(() => {
    setRole((prevRole) => (prevRole === 'host' ? 'participant' : 'host'));
  }, []);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }
    
    // Initial check for connected accounts
    const checkConnection = async () => {
        if(window.ethereum) {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                setAddress(accounts[0]);
                setIsConnected(true);
            }
        }
    };
    checkConnection();

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const value = { isConnected, address, role, connectWallet, disconnectWallet, toggleRole, setRole };

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
