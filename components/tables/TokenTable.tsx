'use client';
import { useEffect, useState } from 'react';
import { formatCurrency, formatPercentage } from '@/utils/formatters';

const TokenLetterCircle = ({ token }: { token: string }) => {
  const letter = (token || '?').charAt(0).toUpperCase();
  
  return (
    <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold font-semibold">
      {letter}
    </div>
  );
};

interface TokenMetadata {
  name: string;
  token: string;
  image?: string;
}

interface TokenBalance {
  mint: string;
  amount: number;
  decimals?: number;
  uiAmount?: number;
  token?: string;
  usdValue?: number;
  price?: number;
  isLpPosition?: boolean;
  lpDetails?: {
    name: string;
    token0: string;
    token1: string;
    amount0: number;
    amount1: number;
    valueUSD: number;
    notes?: string;
  };
}

// Initial token metadata that will be expanded by API data
const INITIAL_TOKEN_METADATA: Record<string, TokenMetadata> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    name: 'USD Coin',
    token: 'USDC',
    image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    name: 'USDT',
    token: 'USDT',
    image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png'
  },
  'So11111111111111111111111111111111111111112': {
    name: 'Solana',
    token: 'SOL',
    image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  },
  '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b': {
    name: 'Virtual Protocol',
    token: 'VIRTUAL',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/virtual.png'
  },
  'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC': {
    name: 'ai16z',
    token: 'AI16Z',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/ai16z.png'
  },
  '0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825': {
    name: 'aixbt by Virtuals',
    token: 'AIXBT',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/aixbt.png'
  },
  'KENJSUYLASHUMfHyy5o4Hp2FdNqZg1AsUPhfH2kYvEP': {
    name: 'test griffain.com',
    token: 'GRIFFAIN',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/griffain.png'
  },
  'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump': {
    name: 'Goatseus Maximus',
    token: 'GOAT',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/goat.png'
  },
  '8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn': {
    name: 'zerebro',
    token: 'ZEREBRO',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/zerebro.png'
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

function formatTokentoken(token: string): string {
  return token.startsWith('$') ? token : `$${token}`;
}

interface TokenTableProps {
  showAllTokens?: boolean;
}

export const TokenTable = ({ showAllTokens = false }: TokenTableProps) => {
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenMetadata, setTokenMetadata] = useState<Record<string, TokenMetadata>>(INITIAL_TOKEN_METADATA);

  // Fetch token metadata
  useEffect(() => {
    const fetchTokenMetadata = async () => {
      try {
        const response = await fetch('/api/token-metadata');
        if (!response.ok) {
          throw new Error('Failed to fetch token metadata');
        }
        const data = await response.json();
        setTokenMetadata(data);
      } catch (err) {
        console.error('Error fetching token metadata:', err);
      }
    };

    fetchTokenMetadata();
  }, []);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const endpoint = showAllTokens ? '/api/tokens' : '/api/portfolio';
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch token data');
        }
        const data = await response.json();
        
        // Filter out COMPUTE and UBC tokens if needed
        const filteredTokens = showAllTokens ? data : data.filter((token: TokenBalance) => {
          const metadata = TOKEN_METADATA[token.mint];
          return !(
            metadata?.token === 'COMPUTE' || 
            metadata?.token === 'UBC' ||
            token.token === 'COMPUTE' ||
            token.token === 'UBC'
          );
        });
        
        setTokens(filteredTokens);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tokens');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokens();
  }, [showAllTokens]);

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
          {tokens.map((token, index) => {
            const usdValue = token.usdValue || 0;
            const percentage = totalValue > 0 ? (usdValue / totalValue * 100) : 0;
            
            // Special handling for LP positions
            if (token.isLpPosition) {
              return (
                <tr key={`lp-${index}`} className="border-t border-gold/10 bg-gold/5">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-300 font-semibold">
                        LP
                      </div>
                      <div>
                        <div className="text-purple-300 font-medium">
                          {token.token}
                        </div>
                        {token.lpDetails && (
                          <div className="text-xs text-gray-400">
                            {token.lpDetails.amount0.toFixed(2)} {token.lpDetails.token0} + {token.lpDetails.amount1.toFixed(2)} {token.lpDetails.token1}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-4 py-2 text-gray-300">
                    1 Position
                  </td>
                  <td className="text-right px-4 py-2 text-gray-300">
                    {formatCurrency(usdValue)}
                  </td>
                  <td className="text-right px-4 py-2 text-gray-300">
                    {percentage.toFixed(1)}%
                  </td>
                </tr>
              );
            }
            
            // Regular token handling
            const metadata = tokenMetadata[token.mint] || {
              name: token.token || token.mint.slice(0, 4),
              token: token.token || token.mint.slice(0, 4),
            };
            
            const displayAmount = token.uiAmount !== undefined ? token.uiAmount : token.amount;
            
            return (
              <tr key={token.mint} className="border-t border-gold/10">
                <td className="px-4 py-2">
                  <a 
                    href={`https://solscan.io/token/${token.mint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:opacity-80"
                  >
                    {metadata.image ? (
                      <img 
                        src={metadata.image} 
                        alt={metadata.token}
                        className="w-6 h-6 rounded-full"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const sibling = target.nextElementSibling as HTMLElement;
                          if (sibling) {
                            sibling.style.display = 'flex';
                          }
                        }}
                      />
                    ) : (
                      <TokenLetterCircle token={metadata.token} />
                    )}
                    <div>
                      <div className={getTokenClass(metadata.token)}>
                        {formatTokentoken(metadata.token)}
                      </div>
                      <div className="text-xs text-gray-400">{metadata.name}</div>
                    </div>
                  </a>
                </td>
                <td className="text-right px-4 py-2 text-gray-300">
                  {Number(displayAmount).toLocaleString('en-US', {
                    minimumFractionDigits: displayAmount > 0 && displayAmount < 1 ? 4 : 0,
                    maximumFractionDigits: displayAmount > 0 && displayAmount < 1 ? 4 : 0
                  })}
                </td>
                <td className="text-right px-4 py-2 text-gray-300">
                  {usdValue > 0 ? (
                    formatCurrency(usdValue)
                  ) : (
                    <span className="text-yellow-500">$0.00 (no price data)</span>
                  )}
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
              ${totalValue.toLocaleString('en-US', {
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
