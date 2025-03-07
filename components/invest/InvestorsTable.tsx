'use client';
import { useState, useEffect } from 'react';
import { TokenDisplay } from '@/utils/tokenDisplay';
import { useWallet } from '@solana/wallet-adapter-react';

// Define types
type SortField = 'date' | 'return';
type SortDirection = 'asc' | 'desc';

interface Investor {
  investmentId: string;
  amount: number; // This is now the redistribution amount (previously ubcReturn)
  token?: string;
  usdAmount?: number;
  solscanUrl?: string;
  date: string;
  username?: string;
  wallet: string;
  return?: number;
  isCalculated?: boolean;
  redistributionId?: string;
  redistributionDate?: string;
  percentage?: number; // Add percentage field
  claimed?: boolean; // Add claimed status field
}

interface InvestorsTableProps {
  initialData?: Investor[];
}

function getDaysAgo(date: Date): string {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else {
    return `${diffDays} days ago`;
  }
}

export function RedistributionsTable({ initialData = [] }: InvestorsTableProps) {
  // Add the useWallet hook to get the connected wallet
  const { publicKey } = useWallet();
  
  // State for sorting and data
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [investors, setInvestors] = useState<Investor[]>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [totalInvestment, setTotalInvestment] = useState(0);
  const [claimingId, setClaimingId] = useState<string | null>(null); // Add state for tracking claiming process

  // Add a function to handle claiming
  const handleClaim = async (investorId: string, wallet: string) => {
    // Check if the user is connected and the wallet matches
    if (!publicKey || publicKey.toString() !== wallet) {
      alert('Please connect the correct wallet to claim');
      return;
    }

    try {
      setClaimingId(investorId); // Set claiming state to show loading

      // Call the API to claim the redistribution
      const response = await fetch('/api/claim-redistribution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          redistributionId: investorId,
          wallet: wallet
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to claim redistribution');
      }

      // Update the local state to show as claimed
      setInvestors(prevInvestors => 
        prevInvestors.map(investor => 
          investor.investmentId === investorId 
            ? { ...investor, claimed: true } 
            : investor
        )
      );

      alert('Redistribution claimed successfully!');
    } catch (error) {
      console.error('Error claiming redistribution:', error);
      alert('Failed to claim redistribution. Please try again.');
    } finally {
      setClaimingId(null); // Reset claiming state
    }
  };

  // Fetch data from API
  useEffect(() => {
    async function fetchInvestors() {
      try {
        const timestamp = new Date().getTime(); // Cache-busting
        const response = await fetch(`/api/investments?t=${timestamp}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch investors: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Fetched ${data.length} investors`);
        
        setInvestors(data);
        
        // Calculate total investment
        const total = data.reduce((sum: number, investor: Investor) => {
          return sum + (investor.usdAmount || 0);
        }, 0);
        
        setTotalInvestment(total);
      } catch (error) {
        console.error('Error fetching investors:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchInvestors();
  }, []);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort investors based on current sort field and direction
  const sortedInvestors = [...investors].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    switch (sortField) {
      case 'date':
        return multiplier * (new Date(a.date).getTime() - new Date(b.date).getTime());
      case 'return':
        return multiplier * ((a.amount || 0) - (b.amount || 0));
      default:
        return 0;
    }
  });

  // Helper to render sort indicator
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold"></div>
          <p className="mt-2">Loading redistributions data...</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gold/20">
                  <th className="px-4 py-3 text-left font-bold">
                    Username/Wallet
                  </th>
                  <th 
                    className="px-4 py-3 text-right font-bold cursor-pointer hover:text-gold"
                    onClick={() => handleSort('return')}
                  >
                    Weekly Redistribution{renderSortIndicator('return')}
                  </th>
                  <th 
                    className="px-4 py-3 text-left font-bold cursor-pointer hover:text-gold"
                    onClick={() => handleSort('date')}
                  >
                    Date{renderSortIndicator('date')}
                  </th>
                  <th className="px-4 py-3 text-center font-bold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedInvestors.map((investor) => (
                  <tr key={investor.investmentId} className="border-b border-gold/10 hover:bg-gold/5">
                    {/* Username/Wallet Cell */}
                    <td className="px-4 py-4 text-white">
                      {investor.username && investor.username !== "Anonymous" ? (
                        <span title={investor.wallet}>
                          {investor.username}
                        </span>
                      ) : investor.wallet ? (
                        <a 
                          href={`https://solscan.io/account/${investor.wallet}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-gold transition-colors"
                          title="View wallet on Solscan"
                        >
                          {`${investor.wallet.substring(0, 4)}...${investor.wallet.substring(investor.wallet.length - 4)}`}
                        </a>
                      ) : (
                        'Anonymous'
                      )}
                    </td>
                    
                    {/* Weekly Return Cell (moved before Investment Value) */}
                    <td className="px-4 py-4 text-right">
                      {investor.amount !== undefined ? (
                        <>
                          <span className={`metallic-text-${(investor.token || 'ubc').toLowerCase()} font-medium`}>
                            {Math.floor(investor.amount || 0).toLocaleString('en-US')} ${investor.token || 'UBC'}
                          </span>
                          {investor.isCalculated && (
                            <span className="text-xs text-yellow-500 ml-1">(Estimated)</span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className={`metallic-text-${(investor.token || 'ubc').toLowerCase()} font-medium`}>
                            0 ${investor.token || 'UBC'}
                          </span>
                        </>
                      )}
                    </td>
                    
                    {/* Date Cell - Modified to show days ago */}
                    <td className="px-4 py-4">
                      {investor.date 
                        ? (
                          <span className="text-gray-400">
                            {getDaysAgo(new Date(investor.date))}
                          </span>
                        )
                        : <span className="text-gray-400">N/A</span>}
                    </td>
                    
                    {/* Add a new cell for the Claim button */}
                    <td className="px-4 py-4 text-center">
                      <button
                        className={`px-4 py-2 rounded-md ${
                          investor.claimed || !publicKey || publicKey.toString() !== investor.wallet || claimingId === investor.investmentId
                            ? 'bg-gray-600 text-gray-300 cursor-not-allowed opacity-50' 
                            : 'bg-gradient-to-r from-orange-500 to-yellow-400 hover:from-orange-600 hover:to-yellow-500 text-black font-medium'
                        }`}
                        disabled={
                          investor.claimed || 
                          !publicKey || 
                          publicKey.toString() !== investor.wallet ||
                          claimingId === investor.investmentId
                        }
                        onClick={() => handleClaim(investor.investmentId, investor.wallet)}
                      >
                        {claimingId === investor.investmentId ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing
                          </span>
                        ) : investor.claimed ? (
                          'Claimed'
                        ) : (
                          'Claim'
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Summary Section */}
          <div className="mt-6 text-sm space-y-1">
            <p className="text-gray-400">
              Last Updated: {new Date().toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              }).replace(/\//g, '/')}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
