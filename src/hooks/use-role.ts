'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { isHost as web3IsHost } from '@/lib/web3-service';

type Role = 'host' | 'participant' | null;

export function useRole() {
    const { address, isConnected } = useAccount();
    const [role, setRole] = useState<Role>(null);
    const [isLoading, setIsLoading] = useState(false);

    const checkRole = useCallback(async (userAddress: string) => {
        setIsLoading(true);
        try {
            const isHostUser = await web3IsHost(userAddress);
            setRole(isHostUser ? 'host' : 'participant');
        } catch (error) {
            console.error('Failed to check role:', error);
            setRole('participant'); // Default to participant on error
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isConnected && address) {
            checkRole(address);
        } else {
            setRole(null);
        }
    }, [isConnected, address, checkRole]);

    return { role, isLoading, checkRole };
}
