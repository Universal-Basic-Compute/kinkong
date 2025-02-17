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
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo.png?size=lg'
  },
  '9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump': {
    name: 'UBC',
    symbol: 'UBC',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump.png?size=lg'
  },
  '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b': {
    name: 'Virtual Protocol',
    symbol: 'VIRTUAL',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/virtual.png'
  },
  'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC': {
    name: 'ai16z',
    symbol: 'AI16Z',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/ai16z.png'
  },
  '0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825': {
    name: 'aixbt by Virtuals',
    symbol: 'AIXBT',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/aixbt.png'
  },
  'KENJSUYLASHUMfHyy5o4Hp2FdNqZg1AsUPhfH2kYvEP': {
    name: 'test griffain.com',
    symbol: 'GRIFFAIN',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/griffain.png'
  },
  'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump': {
    name: 'Goatseus Maximus',
    symbol: 'GOAT',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/goat.png'
  },
  '8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn': {
    name: 'zerebro',
    symbol: 'ZEREBRO',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/zerebro.png'
  }
};


function formatTokenSymbol(token: string): string {
  return token.startsWith('$') ? token : `$${token}`;
}

interface TokenTableProps {
  showAllTokens?: boolean;
}

export const TokenTable = ({ showAllTokens = false }: TokenTableProps) => {
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const endpoint = showAllTokens ? '/api/tokens' : '/api/portfolio';
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch token data');
        }
        const data = await response.json();
        setTokens(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tokens');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokens();
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
