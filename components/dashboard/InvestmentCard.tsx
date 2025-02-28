'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { WalletConnect } from '@/components/wallet/WalletConnect';

interface Investment {
  investmentId: string;
  amount: number;
  token: string;
  date: string;
  solscanUrl: string;
  usdAmount?: number;
  // Add redistribution fields
  ubcReturn?: number;
  return?: number;
  redistributionDate?: string;
}

export function InvestmentCard() {
  const { publicKey, connected } = useWallet();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchInvestments() {
      if (!publicKey) {
        setIsLoading(false);
        return;
      }

      try {
        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/user-investments?wallet=${publicKey.toString()}&t=${timestamp}`);
        if (!response.ok) throw new Error('Failed to fetch investments');
        const data = await response.json();
        console.log('Fetched investments:', data);
        setInvestments(data);
      } catch (error) {
        console.error('Error fetching investments:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (connected && publicKey) {
      fetchInvestments();
    } else {
      setIsLoading(false);
    }
  }, [publicKey, connected]);

  if (!connected) {
    return (
      <div className="stat-card">
        <h3>Your Investment</h3>
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-sm text-gray-400 mb-2">Connect your wallet to view your investments</p>
          <WalletConnect />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="stat-card">
        <h3>Your Investment</h3>
        <p className="text-2xl">Loading...</p>
      </div>
    );
  }

  if (investments.length === 0) {
    return (
      <div className="stat-card">
        <h3>Your Investment</h3>
        <p className="text-lg">No investments found</p>
      </div>
    );
  }

  // Calculate total USD value of all investments
  const totalUsdValue = investments.reduce((sum, inv) => sum + (inv.usdAmount || 0), 0);

  return (
    <div className="stat-card">
      <h3>Your Investments</h3>
      <div className="space-y-2 mt-2">
        {investments.map((investment) => (
          <div key={investment.investmentId} className="border-b border-gold/10 pb-2">
            <p className="flex justify-between">
              <span className="font-medium">
                {investment.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })} 
                <span className={getTokenClass(investment.token)}>
                  ${investment.token || 'USDC'}
                </span>
              </span>
              {investment.usdAmount && (
                <span className="text-sm text-gray-400">
                  (${investment.usdAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })})
                </span>
              )}
            </p>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">
                {new Date(investment.date).toLocaleDateString()}
              </span>
              <a 
                href={investment.solscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:text-gold/80 underline"
              >
                View on Solscan
              </a>
            </div>
            
            {/* Add redistribution information if available */}
            <div className="mt-2 text-sm">
              <p className="flex justify-between">
                <span className="text-gray-400">Latest Return:</span>
                <span className="metallic-text-ubc">
                  {(investment.ubcReturn || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  })} $UBC
                  {investment.isCalculated && (
                    <span className="text-xs text-yellow-500 ml-1">(Est.)</span>
                  )}
                </span>
              </p>
              {investment.redistributionDate && (
                <p className="text-xs text-gray-400 text-right">
                  {new Date(investment.redistributionDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {totalUsdValue > 0 && (
        <div className="mt-3 pt-2 border-t border-gold/10">
          <p className="text-sm text-right">
            Total Value: <span className="font-medium">${totalUsdValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// Helper function to get token-specific CSS class
function getTokenClass(token: string): string {
  if (!token) return 'metallic-text-argent'; // Default style if token is undefined
  
  const upperToken = token.toUpperCase();
  switch (upperToken) {
    case 'UBC':
      return 'metallic-text-ubc';
    case 'COMPUTE':
      return 'metallic-text-compute';
    case 'SOL':
      return 'metallic-text-sol';
    default:
      return 'metallic-text-argent';
  }
}
