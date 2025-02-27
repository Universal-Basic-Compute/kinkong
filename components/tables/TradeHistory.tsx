'use client';
import { useEffect, useState } from 'react';
import { getTokenClass, formatTokenSymbol } from '@/components/utils/tokenUtils';

interface Trade {
  id: string;
  createdAt: string;
  token: string;
  value: number;
  exitValue: number | null;
  status: string;
  exitReason?: string;
  realizedPnl?: number; // In dollars
  roi?: number; // In percentage
  signature: string;
}

interface TradeHistoryProps {
  userOnly?: boolean;
  limit?: number;
  showChartButton?: boolean;
}

export function TradeHistory({ userOnly = false, limit = 10, showChartButton = false }: TradeHistoryProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch(`/api/trades?limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch trades');
        const data = await response.json();
        console.log('Fetched trades:', data); // Debug log
        setTrades(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load trades');
        console.error('Error fetching trades:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrades();
  }, [limit]);


  if (isLoading) return <div>Loading trades...</div>;
  if (error) return <div>Error: {error}</div>;


  function getPnlColor(pnl: number): string {
    return pnl >= 0 ? 'text-green-400' : 'text-red-400';
  }

  function getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'executed':
        return 'bg-yellow-900/50 text-yellow-400';
      case 'closed':
        return 'bg-green-900/50 text-green-400';
      default:
        return 'bg-gray-900/50 text-gray-400';
    }
  }

  function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString.replace(' ', 'T'));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    // Convert to seconds, minutes, hours, days
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffMins > 0) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else {
      return 'just now';
    }
  }

  return (
    <div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-black/50 rounded-lg">
          <thead>
            <tr className="border-b border-gold/20">
              <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Token</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Exit Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">PNL</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">ROI</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Exit Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/10">
            {trades.map((trade) => {
              const timeAgo = trade.createdAt ? formatTimeAgo(trade.createdAt) : '-';

              return (
                <tr key={trade.id} className="hover:bg-gold/5">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {timeAgo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={getTokenClass(trade.token)}>
                      {formatTokenSymbol(trade.token)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    ${(trade.value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {typeof trade.exitValue === 'number' 
                      ? `$${trade.exitValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '-'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${trade.realizedPnl ? getPnlColor(trade.realizedPnl) : 'text-gray-300'}`}>
                    {trade.realizedPnl 
                      ? `${trade.realizedPnl >= 0 ? '+' : ''}$${Math.abs(trade.realizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                      : '-'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${trade.roi ? getPnlColor(trade.roi) : 'text-gray-300'}`}>
                    {trade.roi 
                      ? `${trade.roi >= 0 ? '+' : ''}${trade.roi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` 
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(trade.status)}`}>
                      {trade.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {trade.exitReason ? (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        trade.exitReason === 'COMPLETED' ? 'bg-green-900/30 text-green-400' : 
                        trade.exitReason === 'STOPPED' ? 'bg-red-900/30 text-red-400' : 
                        trade.exitReason === 'EXPIRED' ? 'bg-yellow-900/30 text-yellow-400' : 
                        trade.exitReason === 'CANCELLED' ? 'bg-gray-900/30 text-gray-400' : 
                        'bg-blue-900/30 text-blue-400'
                      }`}>
                        {trade.exitReason}
                      </span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
