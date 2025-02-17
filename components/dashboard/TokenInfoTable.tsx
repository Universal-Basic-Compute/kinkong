'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface TokenInfo {
  symbol: string;
  name: string;
  mint: string;
  volume7d: number;
  liquidity: number;
  volumeGrowth: number;
  pricePerformance: number;
}

interface TokenInfoTableProps {
  tokens: TokenInfo[];
  isLoading: boolean;
  error: string | null;
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

export function TokenInfoTable({ tokens, isLoading, error }: TokenInfoTableProps) {
  const [isTableVisible, setIsTableVisible] = useState(false);

  return (
    <div className="mt-8">
      <button 
        onClick={() => setIsTableVisible(!isTableVisible)}
        className="w-full flex items-center justify-between p-4 bg-black/30 border border-gold/20 rounded-lg hover:bg-gold/5 transition-colors"
      >
        <span className="text-lg font-medium">More Information</span>
        {isTableVisible ? (
          <ChevronUpIcon className="w-5 h-5 text-gold" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-gold" />
        )}
      </button>
      
      {isTableVisible && (
        <div className="mt-4 bg-black/30 p-8 rounded-lg border border-gold/20">
          {isLoading ? (
            <div className="text-center py-4">Loading tokens...</div>
          ) : error ? (
            <div className="text-center py-4 text-red-400">Error: {error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gold/20">
                    <th className="px-4 py-2 text-left text-gold">Token</th>
                    <th className="px-4 py-2 text-left text-gold">Name</th>
                    <th className="px-4 py-2 text-right text-gold">7d Volume</th>
                    <th className="px-4 py-2 text-right text-gold">Liquidity</th>
                    <th className="px-4 py-2 text-right text-gold">Volume Growth</th>
                    <th className="px-4 py-2 text-right text-gold">Price Change</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => (
                    <tr key={token.mint} className="border-b border-gold/10 hover:bg-gold/5">
                      <td className="px-4 py-2">
                        <a 
                          href={`https://solscan.io/token/${token.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`font-medium ${getTokenClass(token.symbol)}`}
                        >
                          ${token.symbol}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-gray-300">{token.name}</td>
                      <td className="px-4 py-2 text-right text-gray-300">
                        ${token.volume7d.toLocaleString(undefined, {
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-300">
                        ${token.liquidity.toLocaleString(undefined, {
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={token.volumeGrowth >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {token.volumeGrowth.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={token.pricePerformance >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {token.pricePerformance.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
