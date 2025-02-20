'use client';
import { useEffect, useState } from 'react';
import { fetchAirtableData } from '@/utils/airtable';

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
  createdAt: string;
  token: string;
  type: 'BUY' | 'SELL';
  timeframe: 'SCALP' | 'INTRADAY' | 'SWING' | 'POSITION';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  url?: string;
  actualReturn?: number;
  wallet?: string;
  code?: string;
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
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState<'ALL' | 'SCALP' | 'INTRADAY' | 'SWING' | 'POSITION'>('ALL');
  const [sortField, setSortField] = useState<'actualReturn' | 'createdAt' | 'token' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'actualReturn' | 'createdAt' | 'token') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortSignals = (a: Signal, b: Signal) => {
    if (!sortField) return 0;
    
    switch (sortField) {
      case 'actualReturn':
        const returnA = a.actualReturn ?? -999;
        const returnB = b.actualReturn ?? -999;
        return sortDirection === 'asc' ? returnA - returnB : returnB - returnA;
        
      case 'createdAt':
        return sortDirection === 'asc' 
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          
      case 'token':
        return sortDirection === 'asc' 
          ? a.token.localeCompare(b.token)
          : b.token.localeCompare(a.token);
          
      default:
        return 0;
    }
  };

  const SortHeader = ({ 
    field, 
    label, 
    currentSort, 
    currentDirection, 
    onSort 
  }: { 
    field: 'createdAt' | 'token' | 'actualReturn';
    label: string;
    currentSort: string | null;
    currentDirection: 'asc' | 'desc';
    onSort: (field: 'actualReturn' | 'createdAt' | 'token') => void;
  }) => (
    <div 
      className="flex items-center gap-2 cursor-pointer group"
      onClick={() => onSort(field)}
    >
      {label}
      <div className="text-gray-400 group-hover:text-gold">
        {currentSort === field ? (
          currentDirection === 'asc' ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
            </svg>
          )
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 opacity-0 group-hover:opacity-100">
            <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </div>
  );

  const fetchSignals = async () => {
    try {
      const response = await fetch('/api/signals');
      if (!response.ok) {
        throw new Error('Failed to fetch signals');
      }
      const data = await response.json();
      setSignals(data); // The API already returns formatted signals
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
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">
              <SortHeader
                field="createdAt"
                label="Time"
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">
              <SortHeader
                field="token"
                label="Token"
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">
              <div className="flex items-center gap-2">
                Type
                <div className="relative group">
                  <div className="cursor-pointer hover:text-gold/80 text-gray-400">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="currentColor" 
                      className="w-4 h-4"
                    >
                      <path d="M18.75 12.75h1.5a.75.75 0 000-1.5h-1.5a.75.75 0 000 1.5zM12 6a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 0112 6zM12 18a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 0112 18zM3.75 6.75h1.5a.75.75 0 100-1.5h-1.5a.75.75 0 000 1.5zM5.25 18.75h-1.5a.75.75 0 010-1.5h1.5a.75.75 0 010 1.5zM3 12a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 013 12zM9 3.75a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5zM12.75 12a2.25 2.25 0 114.5 0 2.25 2.25 0 01-4.5 0zM9 15.75a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
                    </svg>
                  </div>
                  <div className="absolute right-0 mt-2 hidden group-hover:block z-20">
                    <div className="bg-black/95 border border-gold/20 rounded-lg shadow-lg py-2 min-w-[100px]">
                      <div 
                        className={`px-4 py-1 cursor-pointer hover:bg-gold/10 ${typeFilter === 'ALL' ? 'text-gold' : 'text-gray-300'}`}
                        onClick={() => setTypeFilter('ALL')}
                      >
                        All
                      </div>
                      <div 
                        className={`px-4 py-1 cursor-pointer hover:bg-gold/10 ${typeFilter === 'BUY' ? 'text-gold' : 'text-gray-300'}`}
                        onClick={() => setTypeFilter('BUY')}
                      >
                        Buy
                      </div>
                      <div 
                        className={`px-4 py-1 cursor-pointer hover:bg-gold/10 ${typeFilter === 'SELL' ? 'text-gold' : 'text-gray-300'}`}
                        onClick={() => setTypeFilter('SELL')}
                      >
                        Sell
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">
              <div className="flex items-center gap-2">
                Timeframe
                <div className="relative group">
                  <div className="cursor-pointer hover:text-gold/80 text-gray-400">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="currentColor" 
                      className="w-4 h-4"
                    >
                      <path d="M18.75 12.75h1.5a.75.75 0 000-1.5h-1.5a.75.75 0 000 1.5zM12 6a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 0112 6zM12 18a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 0112 18zM3.75 6.75h1.5a.75.75 0 100-1.5h-1.5a.75.75 0 000 1.5zM5.25 18.75h-1.5a.75.75 0 010-1.5h1.5a.75.75 0 010 1.5zM3 12a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 013 12zM9 3.75a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5zM12.75 12a2.25 2.25 0 114.5 0 2.25 2.25 0 01-4.5 0zM9 15.75a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
                    </svg>
                  </div>
                  <div className="absolute right-0 mt-2 hidden group-hover:block z-20">
                    <div className="bg-black/95 border border-gold/20 rounded-lg shadow-lg py-2 min-w-[100px]">
                      <div 
                        className={`px-4 py-1 cursor-pointer hover:bg-gold/10 ${timeframeFilter === 'ALL' ? 'text-gold' : 'text-gray-300'}`}
                        onClick={() => setTimeframeFilter('ALL')}
                      >
                        All
                      </div>
                      <div 
                        className={`px-4 py-1 cursor-pointer hover:bg-gold/10 ${timeframeFilter === 'SCALP' ? 'text-gold' : 'text-gray-300'}`}
                        onClick={() => setTimeframeFilter('SCALP')}
                      >
                        Scalp
                      </div>
                      <div 
                        className={`px-4 py-1 cursor-pointer hover:bg-gold/10 ${timeframeFilter === 'INTRADAY' ? 'text-gold' : 'text-gray-300'}`}
                        onClick={() => setTimeframeFilter('INTRADAY')}
                      >
                        Intraday
                      </div>
                      <div 
                        className={`px-4 py-1 cursor-pointer hover:bg-gold/10 ${timeframeFilter === 'SWING' ? 'text-gold' : 'text-gray-300'}`}
                        onClick={() => setTimeframeFilter('SWING')}
                      >
                        Swing
                      </div>
                      <div 
                        className={`px-4 py-1 cursor-pointer hover:bg-gold/10 ${timeframeFilter === 'POSITION' ? 'text-gold' : 'text-gray-300'}`}
                        onClick={() => setTimeframeFilter('POSITION')}
                      >
                        Position
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Prices</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Confidence</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Reason</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gold uppercase tracking-wider">Success</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gold uppercase tracking-wider">
              <div className="flex justify-end">
                <SortHeader
                  field="actualReturn"
                  label="Return"
                  currentSort={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gold/10">
          {signals
            .filter(signal => 
              (typeFilter === 'ALL' || signal.type === typeFilter) &&
              (timeframeFilter === 'ALL' || signal.timeframe === timeframeFilter)
            )
            .sort(sortSignals)
            .map((signal) => (
            <tr key={signal.id} className="hover:bg-gold/5">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {getRelativeTime(signal.createdAt)}
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
                {typeof signal.actualReturn !== 'undefined' && signal.actualReturn !== null ? (
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
                {typeof signal.actualReturn !== 'undefined' && signal.actualReturn !== null ? (
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
