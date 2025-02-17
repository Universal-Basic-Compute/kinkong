'use client';
import { AllocationChart } from '@/components/dashboard/AllocationChart'
import { TokenTable } from '@/components/tables/TokenTable'
import { PerformanceChart } from '@/components/charts/PerformanceChart'
import { useState, useEffect } from 'react'

interface PortfolioMetrics {
  totalValue: number;
  change24h: number;
  change7d: number;
  history: Array<{timestamp: string; value: number}>;
}

export default function Portfolio() {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    // Refresh every 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen p-4 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">KinKong Portfolio</h1>

      <div className="grid grid-cols-1 gap-8">
        {/* Current Allocation */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Current Allocation</h2>
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
          <h2 className="text-2xl font-bold mb-4">Portfolio Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <h3>Total Value</h3>
              {isLoading ? (
                <p className="text-2xl">Loading...</p>
              ) : error ? (
                <p className="text-2xl text-red-400">Error loading data</p>
              ) : (
                <p className="text-2xl">
                  ${metrics?.totalValue.toLocaleString(undefined, {
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
                <p className={`text-2xl ${metrics?.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {metrics?.change24h >= 0 ? '+' : ''}{metrics?.change24h.toFixed(2)}%
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
                <p className={`text-2xl ${metrics?.change7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {metrics?.change7d >= 0 ? '+' : ''}{metrics?.change7d.toFixed(2)}%
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Performance Chart */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Portfolio Performance</h2>
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
