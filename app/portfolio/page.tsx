'use client';
import { AllocationChart } from '@/components/dashboard/AllocationChart'
import { TokenTable } from '@/components/tables/TokenTable'
import { useState, useEffect } from 'react'

interface TokenInfo {
  symbol: string;
  name: string;
  mint: string;
  volume7d: number;
  liquidity: number;
  volumeGrowth: number;
  pricePerformance: number;
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


export default function Portfolio() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [isTokensLoading, setIsTokensLoading] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);


  useEffect(() => {
    async function fetchTokens() {
      try {
        const response = await fetch('/api/tokens');
        if (!response.ok) throw new Error('Failed to fetch tokens');
        const data = await response.json();
        setTokens(data);
      } catch (err) {
        setTokenError(err instanceof Error ? err.message : 'Failed to load tokens');
      } finally {
        setIsTokensLoading(false);
      }
    }

    fetchTokens();
  }, []);

  return (
    <main className="min-h-screen p-4 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">KinKong Portfolio</h1>

      <div className="grid grid-cols-1 gap-8">
        {/* Current Allocation */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-bold">Current Allocation</h2>
            <div className="group relative">
              <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
                i
              </div>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10 whitespace-pre-line">
                KinKong's allocation strategy:
                • Dynamic position sizing based on market conditions
                • Risk-weighted exposure across AI tokens
                • Regular rebalancing to maintain optimal ratios
                • Liquidity-aware position management
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
              <AllocationChart />
            </div>
            <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
              <TokenTable />
            </div>
          </div>
        </section>

        {/* Portfolio Stats */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-bold">Portfolio Metrics</h2>
            <div className="group relative">
              <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
                i
              </div>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10 whitespace-pre-line">
                KinKong's allocation strategy:
                • Dynamic position sizing based on market conditions
                • Risk-weighted exposure across AI tokens
                • Regular rebalancing to maintain optimal ratios
                • Liquidity-aware position management
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <h3>Total Value</h3>
              {isLoading ? (
                <p className="text-2xl">Loading...</p>
              ) : error ? (
                <p className="text-2xl text-red-400">Error loading data</p>
              ) : (
                <p className="text-2xl">
                  ${(metrics?.totalValue || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              )}
            </div>
            <div className="stat-card">
              <h3>24h Change</h3>
              {isLoading ? (
                <p className="text-2xl">Loading...</p>
              ) : error ? (
                <p className="text-2xl text-red-400">Error loading data</p>
              ) : (
                <p className={`text-2xl ${getChangeClass(metrics?.change24h)}`}>
                  {formatChange(metrics?.change24h)}%
                </p>
              )}
            </div>
            <div className="stat-card">
              <h3>7d Performance</h3>
              {isLoading ? (
                <p className="text-2xl">Loading...</p>
              ) : error ? (
                <p className="text-2xl text-red-400">Error loading data</p>
              ) : (
                <p className={`text-2xl ${getChangeClass(metrics?.change7d)}`}>
                  {formatChange(metrics?.change7d)}%
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Performance Chart */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-bold">Portfolio Performance</h2>
            <div className="group relative">
              <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
                i
              </div>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10 whitespace-pre-line">
                {STRATEGY_INFO.performance}
              </div>
            </div>
          </div>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            {isLoading ? (
              <div className="text-center py-8">Loading chart data...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-400">Error loading chart: {error}</div>
            ) : (
              <PerformanceChart data={metrics?.history || []} />
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
