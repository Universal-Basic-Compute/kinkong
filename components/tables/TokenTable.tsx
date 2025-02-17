'use client';
import { useEffect, useState } from 'react';

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  usdValue?: number;
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

function formatTokenSymbol(token: string): string {
  return token.startsWith('$') ? token : `$${token}`;
}

export const TokenTable = () => {
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const response = await fetch('/api/portfolio');
        if (!response.ok) {
          throw new Error('Failed to fetch portfolio data');
        }
        const data = await response.json();
        setTokens(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load portfolio');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  if (isLoading) {
    return <div className="text-center py-4">Loading portfolio...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-400">Error: {error}</div>;
  }

  const totalValue = tokens.reduce((sum, token) => sum + (token.usdValue || 0), 0);

  return (
    <div>
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="text-left px-4 py-2 text-gold">Token</th>
            <th className="text-right px-4 py-2 text-gold">Balance</th>
            <th className="text-right px-4 py-2 text-gold">Value (USD)</th>
            <th className="text-right px-4 py-2 text-gold">% of Portfolio</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map(token => (
            <tr key={token.mint} className="border-t border-gold/10">
              <td className="px-4 py-2">
                <a 
                  href={`https://solscan.io/token/${token.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${getTokenClass(token.symbol || token.mint)} hover:opacity-80`}
                >
                  {formatTokenSymbol(token.symbol || token.mint.slice(0, 4))}
                </a>
              </td>
              <td className="text-right px-4 py-2 text-gray-300">
                {token.uiAmount.toLocaleString(undefined, {
                  maximumFractionDigits: 4
                })}
              </td>
              <td className="text-right px-4 py-2 text-gray-300">
                {token.usdValue 
                  ? `$${token.usdValue.toLocaleString(undefined, {
                      maximumFractionDigits: 2
                    })}` 
                  : '-'
                }
              </td>
              <td className="text-right px-4 py-2 text-gray-300">
                {token.usdValue && totalValue > 0
                  ? `${((token.usdValue / totalValue) * 100).toFixed(1)}%`
                  : '-'
                }
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gold/20">
            <td className="px-4 py-2 font-bold text-gold">Total</td>
            <td></td>
            <td className="text-right px-4 py-2 font-bold text-gold">
              ${totalValue.toLocaleString(undefined, {
                maximumFractionDigits: 2
              })}
            </td>
            <td className="text-right px-4 py-2 font-bold text-gold">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
