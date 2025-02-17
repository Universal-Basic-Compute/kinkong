'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { SignalHistory } from '@/components/signals/SignalHistory';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { PortfolioSection } from '@/components/dashboard/PortfolioSection';
import { TrackedTokensSection } from '@/components/dashboard/TrackedTokensSection';
import { InvestmentCard } from '@/components/dashboard/InvestmentCard';
import { BubbleChart } from '@/components/dashboard/BubbleChart';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface TokenInfo {
  symbol: string;
  name: string;
  mint: string;
  volume7d: number;
  liquidity: number;
  volumeGrowth: number;
  pricePerformance: number;
  marketCap: number;
}

export default function Dashboard() {
  const { publicKey } = useWallet();
  const [trackedTokens, setTrackedTokens] = useState<TokenInfo[]>([]);
  const [isTrackedTokensLoading, setIsTrackedTokensLoading] = useState(true);
  const [trackedTokensError, setTrackedTokensError] = useState<string | null>(null);
  const [isTableVisible, setIsTableVisible] = useState(false);

  useEffect(() => {
    async function fetchTrackedTokens() {
      try {
        const response = await fetch('/api/tokens');
        if (!response.ok) throw new Error('Failed to fetch tokens');
        const data = await response.json();
        setTrackedTokens(data);
      } catch (err) {
        setTrackedTokensError(err instanceof Error ? err.message : 'Failed to load tokens');
      } finally {
        setIsTrackedTokensLoading(false);
      }
    }

    fetchTrackedTokens();
  }, []);


  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-12">Holder Dashboard</h1>

      <StatsCards investmentComponent={<InvestmentCard />} />

      <PortfolioSection />

      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-8">Recent Signals</h2>
        <SignalHistory />
      </section>

      <section className="mb-16">
        <div className="flex items-center gap-2 mb-8">
          <h2 className="text-2xl font-bold">Tracked Tokens</h2>
          <div className="group relative">
            <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
              i
            </div>
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10">
              List of all AI tokens currently tracked by KinKong for potential trading opportunities.
            </div>
          </div>
        </div>

        {isTrackedTokensLoading ? (
          <div>Loading...</div>
        ) : trackedTokensError ? (
          <div className="text-red-400">Error: {trackedTokensError}</div>
        ) : (
          <BubbleChart tokens={trackedTokens} />
        )}

        {/* Collapsible Table Section */}
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
              {isTrackedTokensLoading ? (
                <div className="text-center py-4">Loading tokens...</div>
              ) : trackedTokensError ? (
                <div className="text-center py-4 text-red-400">Error: {trackedTokensError}</div>
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
                      {trackedTokens.map((token) => (
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
      </section>
    </main>
  );
}
