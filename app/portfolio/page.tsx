'use client';
import { PortfolioSection } from '@/components/dashboard/PortfolioSection';
import { useState, useEffect } from 'react'
import { PerformanceChart } from '@/components/charts/PerformanceChart'
import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { TokenTable } from '@/components/tables/TokenTable';

const STRATEGY_INFO = {
  performance: `Historical portfolio performance tracking:
• Daily value snapshots
• Realized & unrealized gains
• Risk-adjusted returns
• Drawdown analysis
• Position-level P&L tracking
• Volume-weighted performance metrics`,
  allocation: `KinKong's allocation strategy:
• Dynamic position sizing based on market conditions
• Risk-weighted exposure across AI tokens
• Regular rebalancing to maintain optimal ratios
• Liquidity-aware position management`
};

export default function Portfolio() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{
    totalValue: number;
    change24h: number;
    change7d: number;
    history: Array<{timestamp: string; value: number}>;
  } | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const response = await fetch('/api/portfolio-metrics');
        if (!response.ok) throw new Error('Failed to fetch metrics');
        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  return (
    <div className="min-h-screen bg-black">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gold mb-2">Portfolio Dashboard</h1>
          <p className="text-gray-400">Real-time portfolio tracking and analysis</p>
        </div>

        {/* Portfolio Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            <h3 className="text-xl font-semibold text-gold mb-2">Total Value</h3>
            <p className="text-2xl font-bold">
              ${metrics?.totalValue?.toLocaleString() || '0.00'}
            </p>
          </div>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            <h3 className="text-xl font-semibold text-gold mb-2">24h Change</h3>
            <p className={`text-2xl font-bold ${(metrics?.change24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(metrics?.change24h || 0).toFixed(2)}%
            </p>
          </div>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            <h3 className="text-xl font-semibold text-gold mb-2">7d Change</h3>
            <p className={`text-2xl font-bold ${(metrics?.change7d || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(metrics?.change7d || 0).toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Current Allocation */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-bold text-gold">Current Allocation</h2>
            <div className="group relative">
              <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
                i
              </div>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10 whitespace-pre-line">
                {STRATEGY_INFO.allocation}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-black/30 p-6 rounded-lg border border-gold/20 min-h-[400px]">
              <AllocationChart />
            </div>
            <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
              <TokenTable />
            </div>
          </div>
        </section>

        {/* Performance Chart */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-bold text-gold">Portfolio Performance</h2>
            <div className="group relative">
              <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
                i
              </div>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10 whitespace-pre-line">
                {STRATEGY_INFO.performance}
              </div>
            </div>
          </div>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20 min-h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-[400px] text-red-400">
                Error loading chart: {error}
              </div>
            ) : (
              <PerformanceChart data={metrics?.history || []} />
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
