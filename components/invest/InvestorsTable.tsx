'use client';
import { useState, useEffect } from 'react';
import { TokenDisplay } from '@/utils/tokenDisplay';
import { useWallet } from '@solana/wallet-adapter-react';

// Define types
type SortField = 'date' | 'return';
type SortDirection = 'asc' | 'desc';

interface Investor {
  investmentId: string;
  amount: number;
  token: string;
  wallet: string;
  date: string;
  percentage?: number;
  claimed?: boolean;
  hasSubscription?: boolean;
  effectiveRate?: number;
  redistributionId?: string;
  username?: string;
  solscanUrl?: string;
  usdAmount?: number;
  return?: number;
  isCalculated?: boolean;
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
  const [claimingIds, setClaimingIds] = useState<Set<string>>(new Set()); // Track multiple claiming IDs

  // Add a function to handle claiming
  const handleClaim = async (investorId: string, wallet: string) => {
    // Check if the user is connected and the wallet matches
    if (!publicKey) {
      alert('Please connect your wallet to claim');
      // Remove this ID from claiming state
      setClaimingIds(prev => {
        const updated = new Set(prev);
        updated.delete(investorId);
        return updated;
      });
      return;
    }
    
    const connectedWallet = publicKey.toString();
    console.log('Wallet comparison:', {
      connectedWallet,
      investorWallet: wallet,
      match: connectedWallet.toLowerCase() === wallet.toLowerCase()
    });

    if (connectedWallet.toLowerCase() !== wallet.toLowerCase()) {
      alert('Please connect the correct wallet to claim');
      // Remove this ID from claiming state
      setClaimingIds(prev => {
        const updated = new Set(prev);
        updated.delete(investorId);
        return updated;
      });
      return;
    }

    try {
      console.log('Claiming with data:', {
        redistributionId: investorId,
        wallet: wallet
      });

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

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Claim error response:', responseData);
        throw new Error(responseData.error || 'Failed to claim redistribution');
      }

      console.log('Claim response:', responseData);

      // Update the local state to show as claimed
      setInvestors(prevInvestors => 
        prevInvestors.map(investor => 
          (investor.investmentId === investorId || investor.redistributionId === investorId)
            ? { ...investor, claimed: true } 
            : investor
        )
      );

      alert('Redistribution claimed successfully!');
    } catch (error) {
      console.error('Error claiming redistribution:', error);
      alert(`Failed to claim redistribution: ${(error as Error).message}`);
    } finally {
      // Remove this ID from claiming state
      setClaimingIds(prev => {
        const updated = new Set(prev);
        updated.delete(investorId);
        return updated;
      });
    }
  };

  // Fetch data from API
  useEffect(() => {
    async function fetchRedistributions() {
      try {
        const timestamp = new Date().getTime(); // Cache-busting
        const response = await fetch(`/api/redistributions?t=${timestamp}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch redistributions: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Fetched ${data.length} redistributions`);
        
        // Add debugging to check token field
        if (data.length > 0) {
          console.log('Sample redistribution data:', {
            id: data[0].investmentId,
            token: data[0].token,
            amount: data[0].amount
          });
        }
        
        setInvestors(data);
        
        // Calculate total investment
        const total = data.reduce((sum: number, investor: Investor) => {
          return sum + (investor.usdAmount || 0);
        }, 0);
        
        setTotalInvestment(total);
      } catch (error) {
        console.error('Error fetching redistributions:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRedistributions();
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
                      {(() => {
                        // Add debugging to see what's coming from the API
                        console.log(`Investor ${investor.investmentId} token:`, investor.token);
                        console.log(`Investor ${investor.investmentId} amount:`, investor.amount);
                        
                        // Default to UBC if token is missing
                        const tokenType = investor.token || 'UBC';
                        const tokenClass = `metallic-text-${tokenType.toLowerCase()}`;
                        
                        return investor.amount !== undefined ? (
                          <>
                            <span className={tokenClass + " font-medium"}>
                              {Math.floor(investor.amount || 0).toLocaleString('en-US')} ${tokenType}
                            </span>
                            {investor.isCalculated && (
                              <span className="text-xs text-yellow-500 ml-1">(Estimated)</span>
                            )}
                            {investor.hasSubscription && (
                              <div className="text-xs text-green-500">Pro Rate: {investor.effectiveRate}%</div>
                            )}
                            {!investor.hasSubscription && investor.effectiveRate && (
                              <div className="text-xs text-gray-400">Basic Rate: {investor.effectiveRate}%</div>
                            )}
                          </>
                        ) : (
                          <>
                            <span className={tokenClass + " font-medium"}>
                              0 ${tokenType}
                            </span>
                          </>
                        );
                      })()}
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
                      {(() => {
                        // Check if the connected wallet matches this redistribution
                        const isWalletMatch = publicKey && 
                          investor.wallet.toLowerCase() === publicKey.toString().toLowerCase();
                        
                        // Determine button state and text
                        let buttonDisabled = true;
                        let buttonTooltip = '';
                        
                        if (investor.claimed) {
                          // Claimed state
                          return (
                            <div className="relative group">
                              <button
                                className="px-4 py-2 rounded-md bg-gray-600 text-gray-300 cursor-not-allowed opacity-50"
                                disabled={true}
                                title="This redistribution has already been claimed"
                              >
                                Claimed
                              </button>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                                This redistribution has already been claimed
                              </div>
                            </div>
                          );
                        } else if (claimingIds.has(investor.redistributionId || '') || claimingIds.has(investor.investmentId || '')) {
                          // Processing state
                          return (
                            <div className="relative group">
                              <button
                                className="px-4 py-2 rounded-md bg-gray-600 text-gray-300 cursor-not-allowed opacity-50"
                                disabled={true}
                              >
                                <span className="flex items-center justify-center">
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Processing
                                </span>
                              </button>
                            </div>
                          );
                        } else {
                          // Normal claim button (enabled or disabled based on wallet match)
                          if (!publicKey) {
                            buttonTooltip = 'Connect your wallet to claim';
                          } else if (!isWalletMatch) {
                            buttonTooltip = `Connect wallet ${investor.wallet.substring(0, 4)}...${investor.wallet.substring(investor.wallet.length - 4)} to claim`;
                          } else {
                            buttonDisabled = false;
                          }
                          
                          return (
                            <div className="relative group">
                              <button
                                className={`px-4 py-2 rounded-md ${
                                  buttonDisabled
                                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed opacity-50' 
                                    : 'bg-gradient-to-r from-orange-500 to-yellow-400 hover:from-orange-600 hover:to-yellow-500 text-black font-medium'
                                }`}
                                disabled={buttonDisabled}
                                onClick={() => {
                                  // Add this ID to the claiming set
                                  const idToUse = investor.redistributionId || investor.investmentId;
                                  setClaimingIds(prev => {
                                    const updated = new Set(prev);
                                    updated.add(idToUse);
                                    return updated;
                                  });
                                  handleClaim(idToUse, investor.wallet);
                                }}
                                title={buttonTooltip}
                              >
                                Claim
                              </button>
                              {buttonTooltip && (
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                                  {buttonTooltip}
                                </div>
                              )}
                            </div>
                          );
                        }
                      })()}
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
