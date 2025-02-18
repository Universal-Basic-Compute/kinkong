'use client';
import { useEffect, useState } from 'react';

type SignalUpdateListener = () => void;
const signalUpdateListeners: SignalUpdateListener[] = [];

export const signalEvents = {
  subscribe: (listener: SignalUpdateListener) => {
    signalUpdateListeners.push(listener);
    return () => {
      const index = signalUpdateListeners.indexOf(listener);
      if (index > -1) signalUpdateListeners.splice(index, 1);
    };
  },
  emit: () => {
    signalUpdateListeners.forEach(listener => listener());
  }
};

function formatTokenSymbol(token: string): string {
  return token.startsWith('$') ? token : `$${token}`;
}

function getTimeframeEmoji(timeframe: Signal['timeframe']): string {
  switch (timeframe) {
    case 'SCALP':
      return '⚡'; // Lightning bolt for quick trades
    case 'INTRADAY':
      return '📅'; // Calendar for day trading
    case 'SWING':
      return '🌊'; // Wave for swing trading
    case 'POSITION':
      return '🎯'; // Target for long-term positions
    default:
      return '📊'; // Chart as fallback
  }
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

function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return formatDisplayDate(timestamp); // Fall back to full date for older signals
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
  timeframe: 'SCALP' | 'INTRADAY' | 'SWING' | 'POSITION';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  wallet: string;
  reason: string;
  url?: string;
}

function getConfidenceClass(confidence: Signal['confidence']) {
  switch (confidence) {
    case 'HIGH':
      return 'bg-green-900/50 text-green-400';
    case 'MEDIUM':
      return 'bg-yellow-900/50 text-yellow-400';
    case 'LOW':
      return 'bg-red-900/50 text-red-400';
    default:
      return 'bg-gray-900/50 text-gray-400';
  }
}

export function SignalHistory() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignals = async () => {
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
  };

  useEffect(() => {
    fetchSignals();
    
    // Subscribe to signal updates
    const unsubscribe = signalEvents.subscribe(() => {
      fetchSignals();
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
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
      <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
        <table className="min-w-full bg-black/50 rounded-lg">
          <thead className="sticky top-0 bg-black/95 z-10">
            <tr className="border-b border-gold/20">
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Time</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Token</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Timeframe</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Prices</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Confidence</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">From</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Reason</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gold uppercase tracking-wider">Success</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gold uppercase tracking-wider">Return</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gold/10">
          {signals.map((signal) => (
            <tr key={signal.id} className="hover:bg-gold/5">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {getRelativeTime(signal.timestamp)}
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
                <span className="text-gray-300">
                  {getTimeframeEmoji(signal.timeframe)} {signal.timeframe}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="text-xs space-y-1">
                  {signal.entryPrice && (
                    <div>Entry: <span className="text-gray-300">${signal.entryPrice}</span></div>
                  )}
                  {signal.targetPrice && (
                    <div>Target: <span className="text-green-400">${signal.targetPrice}</span></div>
                  )}
                  {signal.stopLoss && (
                    <div>Stop: <span className="text-red-400">${signal.stopLoss}</span></div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-2 py-1 rounded-full text-xs ${getConfidenceClass(signal.confidence)}`}>
                  {signal.confidence}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <a 
                  href={`https://solscan.io/account/${signal.wallet}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm hover:underline ${
                    signal.wallet === 'FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY' 
                      ? 'text-gold font-semibold' 
                      : 'text-gray-300'
                  }`}
                >
                  {signal.wallet === 'FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY' 
                    ? '🦍 KinKong'
                    : `${signal.wallet.slice(0, 4)}...${signal.wallet.slice(-4)}`}
                </a>
              </td>
              <td className="px-6 py-4 relative group">
                <p className="text-xs text-gray-300 line-clamp-3 max-h-[4.5rem] overflow-hidden">
                  {signal.reason || '-'}
                </p>
                <div className="hidden group-hover:block absolute left-0 top-full mt-2 z-10">
                  <div className="bg-black/90 border border-gold/20 rounded-lg p-3 max-w-md text-sm text-gray-300 whitespace-pre-line shadow-lg">
                    {signal.reason || '-'}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center text-2xl">
                {signal.actualReturn ? (
                  signal.actualReturn > 0 ? (
                    <span className="metallic-text-ubc font-bold">✓</span>
                  ) : (
                    <span className="text-red-500 font-bold">×</span>
                  )
                ) : (
                  <span style={{ color: '#333333', filter: 'grayscale(100%) brightness(0.3)' }}>⌛</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                {signal.actualReturn ? (
                  <span className={signal.actualReturn >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {signal.actualReturn.toFixed(2)}%
                  </span>
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
