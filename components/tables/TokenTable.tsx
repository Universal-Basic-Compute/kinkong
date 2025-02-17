'use client';
import { useEffect, useState } from 'react';

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
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

  return (
    <table className="min-w-full">
      <thead>
        <tr>
          <th className="text-left px-4 py-2 text-gold">Token</th>
          <th className="text-right px-4 py-2 text-gold">Balance</th>
          <th className="text-right px-4 py-2 text-gold">Value (USD)</th>
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
                className="text-gold hover:text-gold/80"
              >
                {token.symbol || token.mint.slice(0, 4)}...
              </a>
            </td>
            <td className="text-right px-4 py-2">
              {token.uiAmount.toLocaleString(undefined, {
                maximumFractionDigits: 4
              })}
            </td>
            <td className="text-right px-4 py-2">
              Coming soon
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
