'use client';
import { PerformanceChart } from '@/components/charts/PerformanceChart'
import { TradeHistory } from '@/components/tables/TradeHistory'
import { useState, useEffect } from 'react';

interface PerformanceMetrics {
  totalReturn: string;
  winRate: string;
  sharpeRatio: string;
  maxDrawdown: string;
  totalTrades: number;
}

interface ChartData {
  timestamp: string;
  value: number;
}

export default function Performance() {
  const [performanceData, setPerformanceData] = useState<ChartData[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        const response = await fetch('/api/performance-metrics');
        if (!response.ok) throw new Error('Failed to fetch performance data');
        const data = await response.json();
        setPerformanceData(data.history || []);
        setMetrics(data.metrics);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load performance data');
        console.error('Error fetching performance data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformanceData();
  }, []);

  return (
    <div className="min-h-screen bg-black">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gold mb-2">Performance & Analytics</h1>
          <p className="text-gray-400">Detailed trading performance metrics and history</p>
        </div>

        {/* Key Metrics */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gold mb-4">Key Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
              <h3 className="text-gray-400 mb-1">Total Return</h3>
              <p className={`text-2xl font-bold ${Number(metrics?.totalReturn) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {metrics?.totalReturn || '0'}%
              </p>
            </div>
            <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
              <h3 className="text-gray-400 mb-1">Win Rate</h3>
              <p className="text-2xl font-bold text-blue-400">
                {metrics?.winRate || '0'}%
              </p>
            </div>
            <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
              <h3 className="text-gray-400 mb-1">Sharpe Ratio</h3>
              <p className="text-2xl font-bold text-yellow-400">
                {metrics?.sharpeRatio || '0'}
              </p>
            </div>
            <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
              <h3 className="text-gray-400 mb-1">Max Drawdown</h3>
              <p className="text-2xl font-bold text-red-400">
                {metrics?.maxDrawdown || '0'}%
              </p>
            </div>
          </div>
        </section>

        {/* Performance Chart */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gold mb-4">Historical Performance</h2>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20 min-h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-[400px] text-red-400">
                {error}
              </div>
            ) : (
              <PerformanceChart data={performanceData} />
            )}
          </div>
        </section>

        {/* Trade History */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gold mb-4">Recent Trades</h2>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            <TradeHistory />
          </div>
        </section>
      </main>
    </div>
  );
}
