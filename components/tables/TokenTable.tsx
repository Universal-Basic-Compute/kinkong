'use client';
import { useEffect, useState } from 'react';

interface TokenMetadata {
  name: string;
  symbol: string;
  image?: string;
}

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  usdValue?: number;
}

const TOKEN_METADATA: Record<string, TokenMetadata> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    name: 'USD Coin',
    symbol: 'USDC',
    image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    name: 'USDT',
    symbol: 'USDT',
    image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png'
  },
  'So11111111111111111111111111111111111111112': {
    name: 'Solana',
    symbol: 'SOL',
    image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  },
  'B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo': {
    name: 'Compute',
    symbol: 'COMPUTE',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo.png?size=lg&key=521a23'
  },
  '9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump': {
    name: 'UBC',
    symbol: 'UBC',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump.png?size=lg&key=2155bb'
  }
};

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
          {tokens.map(token => {
            const usdValue = token.usdValue || 0;
            const percentage = totalValue > 0 ? (usdValue / totalValue * 100) : 0;
            const metadata = TOKEN_METADATA[token.mint] || {
              name: token.symbol || token.mint.slice(0, 4),
              symbol: token.symbol || token.mint.slice(0, 4),
            };

            return (
              <tr key={token.mint} className="border-t border-gold/10">
                <td className="px-4 py-2">
                  <a 
                    href={`https://solscan.io/token/${token.mint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:opacity-80"
                  >
                    {metadata.image && (
                      <img 
                        src={metadata.image} 
                        alt={metadata.symbol}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <div>
                      <div className={getTokenClass(metadata.symbol)}>
                        {formatTokenSymbol(metadata.symbol)}
                      </div>
                      <div className="text-xs text-gray-400">{metadata.name}</div>
                    </div>
                  </a>
                </td>
                <td className="text-right px-4 py-2 text-gray-300">
                  {Number(token.uiAmount).toLocaleString(undefined, {
                    maximumFractionDigits: 0
                  })}
                </td>
                <td className="text-right px-4 py-2 text-gray-300">
                  ${usdValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </td>
                <td className="text-right px-4 py-2 text-gray-300">
                  {percentage.toFixed(1)}%
                </td>
              </tr>
            );
          })}
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
