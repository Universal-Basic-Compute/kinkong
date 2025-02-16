'use client';
import { useEffect, useState } from 'react';

function formatTokenSymbol(token: string): string {
  return token.startsWith('$') ? token : `$${token}`;
}

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

function formatDisplayDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.warn('Error formatting date:', error);
    return 'Invalid date';
  }
}

interface Signal {
  id: string;
  timestamp: string;
  token: string;
  type: 'BUY' | 'SELL';
  wallet: string;
  reason?: string;
  url?: string;
}

export function SignalHistory() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSignals() {
      try {
        const response = await fetch('/api/signals');
        if (!response.ok) {
          throw new Error('Failed to fetch signals');
        }
        const data = await response.json();
        setSignals(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load signals');
        console.error('Error fetching signals:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSignals();
  }, []);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-pulse text-gold">Loading signals...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-400">
        Error: {error}
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No signals found. Be the first to submit one!
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-black/50 rounded-lg">
        <thead>
          <tr className="border-b border-gold/20">
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Time</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Token</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">From</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Reason</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Reference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gold/10">
          {signals.map((signal) => (
            <tr key={signal.id} className="hover:bg-gold/5">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {formatDisplayDate(signal.timestamp)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={getTokenClass(signal.token)}>
                  {formatTokenSymbol(signal.token)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  signal.type === 'BUY' 
                    ? 'bg-green-900/50 text-green-400' 
                    : 'bg-red-900/50 text-red-400'
                }`}>
                  {signal.type}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`text-sm ${
                  signal.wallet === 'KinKong' 
                    ? 'text-gold font-semibold' 
                    : 'text-gray-300'
                }`}>
                  {signal.wallet.slice(0, 4)}...{signal.wallet.slice(-4)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {signal.reason || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {signal.url ? (
                  <a 
                    href={signal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold hover:text-gold/80 underline"
                  >
                    View
                  </a>
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
