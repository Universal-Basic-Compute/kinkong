'use client';
import { useEffect, useState } from 'react';

interface Trade {
  id: string;
  timestamp: string;
  token: string;
  type: 'BUY' | 'SELL';
  amount: number;
  price: number;
  value: number;
  status: string;
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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-black/50 rounded-lg">
        <thead>
          <tr className="border-b border-gold/20">
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Time</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Token</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Amount</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Price</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Value</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gold/10">
          {trades.map((trade) => (
            <tr key={trade.id} className="hover:bg-gold/5">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {new Date(trade.timestamp).toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{trade.token}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  trade.type === 'BUY' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                }`}>
                  {trade.type}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {trade.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                ${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                ${trade.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  trade.status === 'SUCCESS' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                }`}>
                  {trade.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
