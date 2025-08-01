'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

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

  const connectWallet = useCallback(() => {
    // Simulate wallet connection
    const dummyAddress = `0x${[...Array(40)]
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('')}`;
    setAddress(dummyAddress);
    setIsConnected(true);
  }, []);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setIsConnected(false);
  }, []);

  const toggleRole = useCallback(() => {
    setRole((prevRole) => (prevRole === 'host' ? 'participant' : 'host'));
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
