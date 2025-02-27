'use client';
import { useState, useEffect } from 'react';
import { TokenTable } from '@/components/tables/TokenTable';
import { BubbleChart } from '@/components/dashboard/BubbleChart';
import { TokenInfo } from '@/types/token';

export default function TokensPage() {
  const [trackedTokens, setTrackedTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrackedTokens() {
      try {
        const response = await fetch('/api/tokens');
        if (!response.ok) throw new Error('Failed to fetch tokens');
        const data = await response.json();
        setTrackedTokens(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tokens');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTrackedTokens();
  }, []);

  // Calculate token statistics
  const totalTokens = trackedTokens.length;
  const totalVolume = trackedTokens.reduce((sum, token) => sum + (token.volume7d || 0), 0);
  const avgLiquidity = trackedTokens.length > 0 
    ? trackedTokens.reduce((sum, token) => sum + (token.liquidity || 0), 0) / trackedTokens.length 
    : 0;

  return (
    <main className="min-h-screen p-4 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">AI Tokens</h1>

      <div className="grid grid-cols-1 gap-8">
        {/* Token Stats */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Tracked Tokens</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stat-card">
              <div className="flex items-center gap-2">
                <h3>Total Tokens</h3>
                <div className="group relative">
                  <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
                    i
                  </div>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10">
                    Tokens monitored for price action, volume trends, and market developments
                  </div>
                </div>
              </div>
              <p className="text-2xl">{isLoading ? 'Loading...' : totalTokens}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2">
                <h3>Active Tokens</h3>
                <div className="group relative">
                  <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
                    i
                  </div>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10">
                    Tokens currently included in our active trading strategy
                  </div>
                </div>
              </div>
              <p className="text-2xl">
                {isLoading 
                  ? 'Loading...' 
                  : trackedTokens.filter(token => token.isActive).length
                }
              </p>
            </div>
          </div>
        </section>

        {/* Bubble Chart */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-bold">Token Landscape</h2>
            <div className="group relative">
              <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
                i
              </div>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10">
                Visual representation of AI tokens tracked by KinKong. Size represents liquidity, position represents price trend (vertical) and volume growth (horizontal).
              </div>
            </div>
          </div>
          
          {isLoading ? (
            <div className="text-center py-8 bg-black/30 rounded-lg border border-gold/20">Loading token data...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-400 bg-black/30 rounded-lg border border-gold/20">Error: {error}</div>
          ) : (
            <BubbleChart tokens={trackedTokens} />
          )}
        </section>

        {/* Token Table */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Token Details</h2>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            {isLoading ? (
              <div className="text-center py-8">Loading token data...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-400">Error: {error}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gold/20">
                      <th className="px-4 py-2 text-left text-gold">Active</th>
                      <th className="px-4 py-2 text-left text-gold">Token</th>
                      <th className="px-4 py-2 text-left text-gold">Name</th>
                      <th className="px-4 py-2 text-right text-gold">Volume Growth</th>
                      <th className="px-4 py-2 text-right text-gold">Price Change</th>
                      <th className="px-4 py-2 text-left text-gold">X Account</th>
                      <th className="px-4 py-2 text-left text-gold">Website</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackedTokens.map((token, index) => (
                      <tr key={`token-${token.mint}-${index}`} className="border-b border-gold/10 hover:bg-gold/5 relative group cursor-default">
                        <td className="px-4 py-2">
                          {token.isActive ? (
                            <span className="text-green-500">✓</span>
                          ) : (
                            <span className="text-red-500">✗</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <a 
                            href={`https://solscan.io/token/${token.mint}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`font-medium ${getTokenClass(token.token)}`}
                          >
                            ${token.token}
                          </a>
                        </td>
                        <td className="px-4 py-2 text-gray-300">{token.name}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={(token.volumeGrowth || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {(token.volumeGrowth || 0).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className={(token.priceTrend || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {(token.priceTrend || 0).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-300">
                          {token.xAccount ? (
                            <a
                              href={`https://x.com/${token.xAccount}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              @{token.xAccount}
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-300">
                          {token.website ? (
                            <a
                              href={token.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              Visit
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        
                        {/* Tooltip that appears on row hover */}
                        {token.explanation && (
                          <div className="absolute hidden group-hover:block w-80 p-3 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-50 whitespace-pre-wrap left-1/2 -translate-x-1/2 bottom-full mb-2">
                            {token.explanation.split('\n').map((line, i) => (
                              <div key={i} className="mb-1">
                                {line.startsWith('- ') ? (
                                  <div className="flex">
                                    <span className="mr-1">•</span>
                                    <span>{line.substring(2)}</span>
                                  </div>
                                ) : line.startsWith('# ') ? (
                                  <div className="font-bold text-sm">{line.substring(2)}</div>
                                ) : line.startsWith('## ') ? (
                                  <div className="font-semibold">{line.substring(3)}</div>
                                ) : (
                                  line
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Token Info */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="info-card">
            <h3 className="text-xl font-bold mb-4">Selection Criteria</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Minimum daily volume: $10,000</li>
              <li>• Minimum liquidity: $30,000</li>
              <li>• Active development & community</li>
              <li>• Listed on Jupiter DEX</li>
              <li>• Verified token program</li>
            </ul>
          </div>
          <div className="info-card">
            <h3 className="text-xl font-bold mb-4">Token Updates</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Weekly token review every Friday</li>
              <li>• Performance-based reallocation</li>
              <li>• Regular liquidity checks</li>
              <li>• Community signal integration</li>
              <li>• Emergency removal protocols</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

// Helper function to get token-specific CSS class
function getTokenClass(token: string): string {
  if (!token) return 'metallic-text-argent'; // Default style if token is undefined
  
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
