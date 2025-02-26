'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';

export function InvestmentCard() {
  const { publicKey } = useWallet();
  const [investment, setInvestment] = useState<{
    amount: number;
    token: string;
    date: string;
    solscanUrl: string;
    usdAmount?: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchInvestment() {
      if (!publicKey) return;

      try {
        const response = await fetch(`/api/user-investment?wallet=${publicKey.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch investment');
        const data = await response.json();
        setInvestment(data);
      } catch (error) {
        console.error('Error fetching investment:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchInvestment();
  }, [publicKey]);

  if (isLoading) {
    return (
      <div className="stat-card">
        <h3>Your Investment</h3>
        <p className="text-2xl">Loading...</p>
      </div>
    );
  }

  if (!investment) {
    return (
      <div className="stat-card">
        <h3>Your Investment</h3>
        <p className="text-2xl">No investment found</p>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <h3>Your Investment</h3>
      <p className="text-2xl">
        {investment.amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} {investment.token || 'USDC'}
      </p>
      {investment.usdAmount && investment.token !== 'USDC' && (
        <p className="text-sm text-gray-400">
          (${investment.usdAmount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })})
        </p>
      )}
      <a 
        href={investment.solscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gold hover:text-gold/80 underline mt-1 block"
      >
        View on Solscan
      </a>
    </div>
  );
}
