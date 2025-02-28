import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
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
  claimed: boolean; // Add claimed status
  isCalculated?: boolean; // Add optional calculated status
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
        const walletAddress = publicKey?.toString() || '';
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

  const handleClaim = async (investmentId: string) => {
    if (!confirm('Are you sure you want to claim your rewards?')) {
      return;
    }
    
    try {
      // Show loading state
      setIsLoading(true);
      
      const response = await fetch('/api/investments/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ investmentId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to claim rewards');
      }
      
      const data = await response.json();
      
      alert(`Successfully claimed ${data.amount} ${data.token}! Transaction signature: ${data.signature}`);
      
      // Refresh investments
      const updatedResponse = await fetch('/api/investments');
      if (updatedResponse.ok) {
        const updatedData = await updatedResponse.json();
        
        // Filter investments for the current wallet
        const walletAddress = publicKey?.toString() || '';
        const userInvestments = updatedData.filter((investment: Investment) => 
          investment.wallet.toLowerCase() === walletAddress.toLowerCase()
        );
        
        setInvestments(userInvestments || []);
      }
    } catch (error) {
      console.error('Error claiming rewards:', error);
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Reset loading state
      setIsLoading(false);
    }
  };

  // Function to get token-specific gradient colors
  const getTokenGradient = (token: string) => {
    switch (token) {
      case 'UBC':
        return 'from-purple-600 via-blue-500 to-indigo-600';
      case 'COMPUTE':
        return 'from-amber-500 via-orange-500 to-yellow-500';
      case 'USDC':
        return 'from-blue-500 via-cyan-400 to-teal-500';
      default:
        return 'from-emerald-500 via-teal-500 to-cyan-500';
    }
  };

  if (isLoading) {
    return (
      <div className={`p-6 rounded-lg border border-gray-700 bg-gradient-to-br from-gray-900 to-black ${className}`}>
        <h2 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-300 to-gold">
          Your Investments
        </h2>
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-lg border border-red-800 bg-gradient-to-br from-red-900/50 to-black ${className}`}>
        <h2 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-300 to-gold">
          Your Investments
        </h2>
        <div className="text-red-500 text-center py-4">{error}</div>
      </div>
    );
  }

  if (!publicKey) {
    return (
      <div className={`p-6 rounded-lg border border-gray-700 bg-gradient-to-br from-gray-900 to-black ${className}`}>
        <h2 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-300 to-gold">
          Your Investments
        </h2>
        <div className="text-center py-8 text-gray-400">
          Connect your wallet to view your investments
        </div>
      </div>
    );
  }

  if (investments.length === 0) {
    return (
      <div className={`p-6 rounded-lg border border-gray-700 bg-gradient-to-br from-gray-900 to-black ${className}`}>
        <h2 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-300 to-gold">
          Your Investments
        </h2>
        <div className="text-center py-8 text-gray-400">
          You don't have any active investments
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-lg border border-gold/30 bg-gradient-to-br from-gray-900 to-black shadow-lg shadow-gold/10 ${className}`}>
      <h2 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-300 to-gold">
        Your Investments
      </h2>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gold/20">
              <th className="text-left py-3 px-4 text-gold">Token</th>
              <th className="text-right py-3 px-4 text-gold">Amount</th>
              <th className="text-right py-3 px-4 text-gold">Date</th>
              <th className="text-right py-3 px-4 text-gold">Weekly Return</th>
              <th className="text-right py-3 px-4 text-gold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {investments.map((investment) => (
              <tr 
                key={investment.investmentId} 
                className="border-b border-gray-800/50 hover:bg-black/30 transition-all duration-200"
              >
                <td className="py-3 px-4">
                  <span className={`font-medium text-transparent bg-clip-text bg-gradient-to-r ${getTokenGradient(investment.token)}`}>
                    {investment.token}
                  </span>
                </td>
                <td className="text-right py-3 px-4">
                  <span className="font-medium">
                    {investment.amount.toLocaleString()}
                  </span>{' '}
                  <span className={`text-transparent bg-clip-text bg-gradient-to-r ${getTokenGradient(investment.token)}`}>
                    {investment.token}
                  </span>
                </td>
                <td className="text-right py-3 px-4 text-gray-300">
                  {investment.date ? format(new Date(investment.date), 'MMM d, yyyy') : 'N/A'}
                </td>
                <td className="text-right py-3 px-4">
                  <Tooltip content="Weekly return calculation coming soon">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 font-medium">
                      Coming soon
                    </span>
                  </Tooltip>
                </td>
                <td className="text-right py-3 px-4">
                  {investment.claimed ? (
                    <span className="text-green-500 font-medium">Claimed</span>
                  ) : investment.ubcReturn > 0 ? (
                    <button 
                      onClick={() => handleClaim(investment.investmentId)}
                      className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-indigo-600 hover:to-purple-500 text-white font-medium py-1.5 px-4 rounded-md text-sm transition-all duration-300 shadow-md hover:shadow-purple-500/20 mr-2"
                    >
                      Claim {investment.ubcReturn.toFixed(2)} UBC
                    </button>
                  ) : null}
                  <button 
                    onClick={() => handleWithdraw(investment.investmentId)}
                    className="bg-gradient-to-r from-gold to-amber-500 hover:from-amber-500 hover:to-gold text-black font-medium py-1.5 px-4 rounded-md text-sm transition-all duration-300 shadow-md hover:shadow-gold/20"
                  >
                    Withdraw
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
