'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { WalletConnect } from '@/components/wallet/WalletConnect';

interface ProCheckProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

export function ProCheck({ children, fallback }: ProCheckProps) {
  const { publicKey, connected } = useWallet();
  const [isProMember, setIsProMember] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkSubscription() {
      if (!publicKey) {
        console.log('No wallet connected');
        setIsProMember(false);
        setIsLoading(false);
        return;
      }

      try {
        console.log('Checking subscription for wallet:', publicKey.toString());
        const response = await fetch(`/api/subscription/check?wallet=${publicKey.toString()}`);
        
        if (!response.ok) {
          console.error('Subscription check failed:', await response.text());
          throw new Error('Failed to check subscription');
        }
        
        const data = await response.json();
        console.log('Subscription check result:', data);
        setIsProMember(data.isActive);
      } catch (error) {
        console.error('Error checking subscription:', error);
        setIsProMember(false);
      } finally {
        setIsLoading(false);
      }
    }

    if (connected && publicKey) {
      checkSubscription();
    } else {
      setIsProMember(false);
      setIsLoading(false);
    }
  }, [publicKey, connected]);

  if (!connected) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold mb-6">Connect Your Wallet</h2>
        <p className="text-gray-400 mb-8 text-center max-w-md">
          Please connect your wallet to check if you have access to this feature.
        </p>
        <WalletConnect />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold mb-4"></div>
        <p className="text-gray-400">Checking subscription status...</p>
      </div>
    );
  }

  return isProMember ? children : fallback;
}
