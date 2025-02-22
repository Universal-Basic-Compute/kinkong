'use client';
import { useEffect, useState } from 'react';

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
}

export function TradeHistory({ userOnly = false }: TradeHistoryProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch('/api/trades');
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
  }, []);

  if (isLoading) return <div>Loading trades...</div>;
  if (error) return <div>Error: {error}</div>;

  function getTokenClass(token: string): string {
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

  function formatTokenSymbol(token: string): string {
    return token.startsWith('$') ? token : `$${token}`;
  }

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

  return (
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
            const formattedDate = trade.createdAt 
              ? new Date(trade.createdAt.replace(' ', 'T')).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })
              : '-';

            return (
              <tr key={trade.id} className="hover:bg-gold/5">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {formattedDate}
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {trade.exitReason || '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
