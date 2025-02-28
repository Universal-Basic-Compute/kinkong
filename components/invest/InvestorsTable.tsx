'use client';
import { useState, useEffect } from 'react';
import { TokenDisplay } from '@/utils/tokenDisplay';

// Define types
type SortField = 'date' | 'investment' | 'return';
type SortDirection = 'asc' | 'desc';

interface Investor {
  investmentId: string;
  amount: number; // This will now be investmentValue
  token?: string;
  usdAmount?: number;
  solscanUrl?: string;
  date: string;
  username?: string;
  wallet: string;
  return?: number;
  ubcReturn?: number;
  isCalculated?: boolean;
  redistributionId?: string;
  redistributionDate?: string;
  percentage?: number; // Add percentage field
}

interface InvestorsTableProps {
  initialData?: Investor[];
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) {
    return 'Just now';
  } else if (diffHours === 1) {
    return '1 hour ago';
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else if (diffHours < 48) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '/');
  }
}

export function RedistributionsTable({ initialData = [] }: InvestorsTableProps) {
  // State for sorting and data
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [investors, setInvestors] = useState<Investor[]>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [totalInvestment, setTotalInvestment] = useState(0);

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
      case 'investment':
        return multiplier * ((a.usdAmount || 0) - (b.usdAmount || 0));
      case 'return':
        return multiplier * ((a.ubcReturn || 0) - (b.ubcReturn || 0));
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
      <h2 className="text-xl font-bold mb-4">Latest Redistributions</h2>
      
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
                    Weekly Return{renderSortIndicator('return')}
                  </th>
                  <th 
                    className="px-4 py-3 text-right font-bold cursor-pointer hover:text-gold"
                    onClick={() => handleSort('investment')}
                  >
                    Investment Value{renderSortIndicator('investment')}
                  </th>
                  <th 
                    className="px-4 py-3 text-left font-bold cursor-pointer hover:text-gold"
                    onClick={() => handleSort('date')}
                  >
                    Date{renderSortIndicator('date')}
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
                      {investor.ubcReturn !== undefined || investor.isCalculated ? (
                        <>
                          <span className="metallic-text-ubc font-medium">
                            {Math.floor(investor.ubcReturn || 0).toLocaleString('en-US')} $UBC
                          </span> 
                          <span className="text-gray-400 text-sm ml-1">
                            (${investor.return ? Math.floor(investor.return).toLocaleString('en-US') : '0'})
                          </span>
                          {investor.isCalculated && (
                            <span className="text-xs text-yellow-500 ml-1">(Estimated)</span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="metallic-text-ubc font-medium">
                            0 $UBC
                          </span> 
                          <span className="text-gray-400 text-sm ml-1">
                            ($0)
                          </span>
                        </>
                      )}
                    </td>
                    
                    {/* Investment Value Cell (moved after Weekly Return) */}
                    <td className="px-4 py-4 text-right">
                      {typeof investor.amount === 'number' ? (
                        <>
                          <div>
                            <span className="text-white font-medium">${Math.floor(investor.amount).toLocaleString('en-US')}</span>
                            {investor.percentage && (
                              <span className="text-gray-400 text-sm ml-2">
                                ({investor.percentage.toFixed(2)}%)
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    
                    {/* Date Cell */}
                    <td className="px-4 py-4">
                      {investor.date 
                        ? (
                          <span className="text-gray-400">
                            {formatTimeAgo(new Date(investor.date))}
                          </span>
                        )
                        : <span className="text-gray-400">N/A</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Summary Section */}
          <div className="mt-6 text-sm space-y-1">
            <p>
              <span className="text-gray-400">Total Investment:</span> 
              <span className="text-white ml-2 font-medium">
                {Math.floor(totalInvestment).toLocaleString('en-US')}
              </span> 
              <span className="text-gray-400">$USDC</span>
            </p>
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
