'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';

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
  showChartButton?: boolean;
  limit?: number;
}

export function TradeHistory({ userOnly = false, showChartButton = false, limit = 10 }: TradeHistoryProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState<string | null>(null);

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

  const generateTradeChart = async (signalId: string) => {
    try {
      setChartLoading(signalId);
      const response = await fetch(`/api/signals/chart?id=${signalId}`);
      
      if (!response.ok) {
        throw new Error('Failed to generate chart');
      }
      
      const data = await response.json();
      if (data.success && data.chartUrl) {
        setSelectedChart(data.chartUrl);
      } else {
        throw new Error(data.error || 'Chart generation failed');
      }
    } catch (err) {
      console.error('Error generating chart:', err);
      alert(err instanceof Error ? err.message : 'Failed to generate chart');
    } finally {
      setChartLoading(null);
    }
  };

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
    <div>
      {selectedChart && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-gold/30 rounded-lg p-4 max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gold">Trade Chart</h3>
              <button 
                onClick={() => setSelectedChart(null)}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="relative">
              <img 
                src={selectedChart} 
                alt="Trade Chart" 
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

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
              {showChartButton && (
                <th className="px-6 py-3 text-center text-xs font-medium text-gold uppercase tracking-wider">Chart</th>
              )}
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
                  {showChartButton && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <button
                        onClick={() => generateTradeChart(trade.id)}
                        disabled={chartLoading === trade.id}
                        className="px-2 py-1 bg-gold/20 hover:bg-gold/30 text-gold rounded text-xs transition-colors"
                      >
                        {chartLoading === trade.id ? 'Loading...' : 'View Chart'}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
