'use client';
import { useState, useEffect } from 'react';
import { TokenDisplay } from '@/utils/tokenDisplay';

// Add a type for sort options
type SortField = 'date' | 'investment' | 'return';
type SortDirection = 'asc' | 'desc';

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
    // For older dates, show the date in standard format
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '/');
  }
}

interface Investment {
  investmentId: string;
  amount: number;
  token?: string; // Token type (UBC, COMPUTE, USDC)
  usdAmount?: number; // USD equivalent amount
  solscanUrl: string;
  date: string;
  username?: string;
  wallet: string;
  return?: number; // USDC return
  ubcReturn?: number; // UBC return - this will now come directly from the API
  // Add new fields for redistribution data
  redistributionId?: string;
  redistributionDate?: string;
}

interface WalletSnapshot {
  totalValue: number;
  timestamp: string;
}

interface InvestmentsTableProps {
  investments: Investment[];
  latestSnapshot: WalletSnapshot | null;
  isLoading: boolean;
}

export function InvestmentsTable({ investments: propInvestments, latestSnapshot, isLoading }: InvestmentsTableProps) {
  // Add state for sorting and local data management
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [localInvestments, setLocalInvestments] = useState<Investment[]>(propInvestments || []);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    async function fetchInvestments() {
      try {
        // Add a timestamp to prevent caching
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/investments?t=${timestamp}`);
        if (!response.ok) throw new Error('Failed to fetch investments');
        const data = await response.json();
        console.log('Fetched investments data:', data.length, 'records');
        setLocalInvestments(data);
      } catch (error) {
        console.error('Error fetching investments:', error);
      } finally {
        setIsLoadingData(false);
      }
    }

    fetchInvestments();
  }, []);

  const validateInvestment = (inv: any): inv is Investment => {
    return (
      typeof inv.investmentId === 'string' &&
      typeof inv.amount === 'number' &&
      typeof inv.solscanUrl === 'string' &&
      typeof inv.date === 'string' &&
      typeof inv.wallet === 'string'
    );
  };

  // Add a function to handle sort changes
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

  // Add a function to sort investments
  const sortInvestments = (a: Investment, b: Investment) => {
    // Sort by the selected field
    switch (sortField) {
      case 'date':
        return sortDirection === 'asc' 
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      case 'investment':
        return sortDirection === 'asc'
          ? (a.usdAmount || 0) - (b.usdAmount || 0)
          : (b.usdAmount || 0) - (a.usdAmount || 0);
      case 'return':
        return sortDirection === 'asc'
          ? (a.ubcReturn || 0) - (b.ubcReturn || 0)
          : (b.ubcReturn || 0) - (a.ubcReturn || 0);
      default:
        return 0;
    }
  };

  // Add a helper function to render sort indicators
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
      {isLoading || isLoadingData ? (
        <div className="text-center">Loading investors...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gold/20">
                  <th className="px-4 py-3 text-left font-bold">Username/Wallet</th>
                  <th 
                    className="px-4 py-3 text-right font-bold cursor-pointer hover:text-gold"
                    onClick={() => handleSort('investment')}
                  >
                    Initial Investment{renderSortIndicator('investment')}
                  </th>
                  <th 
                    className="px-4 py-3 text-right font-bold cursor-pointer hover:text-gold"
                    onClick={() => handleSort('return')}
                  >
                    Return{renderSortIndicator('return')}
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
                {localInvestments
                  .filter(validateInvestment)
                  .sort(sortInvestments) // Use the new sort function
                  .map((investment) => (
                  <tr key={investment.investmentId} className="border-b border-gold/10 hover:bg-gold/5">
                    <td className="px-4 py-4 text-white">
                      {investment.username && investment.username !== "Anonymous" ? (
                        <span title={investment.wallet}>
                          {investment.username}
                        </span>
                      ) : investment.wallet ? (
                        <a 
                          href={`https://solscan.io/account/${investment.wallet}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-gold transition-colors"
                          title="View wallet on Solscan"
                        >
                          {`${investment.wallet.substring(0, 4)}...${investment.wallet.substring(investment.wallet.length - 4)}`}
                        </a>
                      ) : (
                        'Anonymous'
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {typeof investment.amount === 'number' ? (
                        <>
                          <div>
                            <span className="text-white font-medium">{Math.floor(investment.amount).toLocaleString('en-US')}</span>{' '}
                            <TokenDisplay 
                              token={investment.token || 'USDC'} 
                              options={{ className: 'text-gray-400' }}
                            />
                          </div>
                          {investment.usdAmount && (
                            <div className="text-gray-400 text-sm">
                              (${Math.floor(investment.usdAmount).toLocaleString('en-US')})
                            </div>
                          )}
                        </>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {investment.ubcReturn !== undefined ? (
                        <>
                          <span className="metallic-text-ubc font-medium">
                            {Math.floor(investment.ubcReturn).toLocaleString('en-US')} $UBC
                          </span> 
                          <span className="text-gray-400 text-sm ml-1">
                            (${investment.return ? Math.floor(investment.return).toLocaleString('en-US') : '0'})
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400">No redistribution yet</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {investment.date 
                        ? (
                          <span className="text-gray-400">
                            {formatTimeAgo(new Date(investment.date))}
                          </span>
                        )
                        : <span className="text-gray-400">N/A</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {latestSnapshot && (
            <div className="mt-6 text-sm space-y-1">
              <p>
                <span className="text-gray-400">Portfolio Value:</span> 
                <span className="text-white ml-2 font-medium">{Math.floor(latestSnapshot.totalValue).toLocaleString('en-US')}</span> 
                <span className="text-gray-400">$USDC</span>
              </p>
              <p>
                <span className="text-gray-400">Total Investment:</span> 
                <span className="text-white ml-2 font-medium">
                  {Math.floor(localInvestments.reduce((sum, inv) => sum + (inv.usdAmount || 0), 0)).toLocaleString('en-US')}
                </span> 
                <span className="text-gray-400">$USDC</span>
              </p>
              <p className="text-gray-400">
                Last Updated: {new Date(latestSnapshot.timestamp).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                }).replace(/\//g, '/')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
