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

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <main className="min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-8">Performance & Analytics</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Historical Performance</h2>
        <PerformanceChart data={performanceData} />
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Key Metrics</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="metric-card bg-gray-800 p-4 rounded-lg">
            <h3 className="text-gray-400">Total Return</h3>
            <p className="text-2xl text-green-400">{metrics?.totalReturn}%</p>
          </div>
          <div className="metric-card bg-gray-800 p-4 rounded-lg">
            <h3 className="text-gray-400">Win Rate</h3>
            <p className="text-2xl text-blue-400">{metrics?.winRate}%</p>
          </div>
          <div className="metric-card bg-gray-800 p-4 rounded-lg">
            <h3 className="text-gray-400">Sharpe Ratio</h3>
            <p className="text-2xl text-yellow-400">{metrics?.sharpeRatio}</p>
          </div>
          <div className="metric-card bg-gray-800 p-4 rounded-lg">
            <h3 className="text-gray-400">Max Drawdown</h3>
            <p className="text-2xl text-red-400">{metrics?.maxDrawdown}%</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Recent Trades</h2>
        <TradeHistory />
      </section>
    </main>
  );
}
