import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Tooltip } from '@/components/ui/tooltip';

interface Investment {
  investmentId: string;
  amount: number;
  token: string;
  date: string;
  wallet: string;
  username: string;
  ubcReturn: number;
  return: number;
  redistributionId: string;
  redistributionDate: string;
  percentage: number;
}

interface YourInvestmentsProps {
  className?: string;
}

export const YourInvestments: React.FC<YourInvestmentsProps> = ({ className }) => {
  const { publicKey } = useWallet();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvestments = async () => {
      if (!publicKey) {
        setInvestments([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch('/api/investments');
        
        if (!response.ok) {
          throw new Error('Failed to fetch investments');
        }
        
        const data = await response.json();
        
        // Filter investments for the current wallet
        const walletAddress = publicKey.toString();
        const userInvestments = data.filter((investment: Investment) => 
          investment.wallet.toLowerCase() === walletAddress.toLowerCase()
        );
        
        setInvestments(userInvestments || []);
      } catch (err) {
        console.error('Error fetching investments:', err);
        setError('Failed to load your investments');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvestments();
  }, [publicKey]);

  const handleWithdraw = async (investmentId: string) => {
    // This will be implemented later
    alert('Withdrawal functionality coming soon!');
  };

  if (isLoading) {
    return (
      <div className={`p-6 rounded-lg border border-gray-700 bg-black/30 ${className}`}>
        <h2 className="text-xl font-bold mb-4">Your Investments</h2>
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-lg border border-gray-700 bg-black/30 ${className}`}>
        <h2 className="text-xl font-bold mb-4">Your Investments</h2>
        <div className="text-red-500 text-center py-4">{error}</div>
      </div>
    );
  }

  if (!publicKey) {
    return (
      <div className={`p-6 rounded-lg border border-gray-700 bg-black/30 ${className}`}>
        <h2 className="text-xl font-bold mb-4">Your Investments</h2>
        <div className="text-center py-8 text-gray-400">
          Connect your wallet to view your investments
        </div>
      </div>
    );
  }

  if (investments.length === 0) {
    return (
      <div className={`p-6 rounded-lg border border-gray-700 bg-black/30 ${className}`}>
        <h2 className="text-xl font-bold mb-4">Your Investments</h2>
        <div className="text-center py-8 text-gray-400">
          You don't have any active investments
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-lg border border-gray-700 bg-black/30 ${className}`}>
      <h2 className="text-xl font-bold mb-4">Your Investments</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4">Token</th>
              <th className="text-right py-3 px-4">Amount</th>
              <th className="text-right py-3 px-4">Date</th>
              <th className="text-right py-3 px-4">Weekly Return</th>
              <th className="text-right py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {investments.map((investment) => (
              <tr key={investment.investmentId} className="border-b border-gray-800 hover:bg-black/20">
                <td className="py-3 px-4">{investment.token}</td>
                <td className="text-right py-3 px-4">{investment.amount.toLocaleString()} {investment.token}</td>
                <td className="text-right py-3 px-4">
                  {investment.date ? format(new Date(investment.date), 'MMM d, yyyy') : 'N/A'}
                </td>
                <td className="text-right py-3 px-4">
                  <Tooltip content="Weekly return calculation coming soon">
                    <span className="text-gray-400">Coming soon</span>
                  </Tooltip>
                </td>
                <td className="text-right py-3 px-4">
                  <Button 
                    onClick={() => handleWithdraw(investment.investmentId)}
                    className="bg-gold hover:bg-gold/80 text-black font-medium py-1 px-3 rounded text-sm"
                  >
                    Withdraw
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
