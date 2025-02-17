'use client';
import { PerformanceChart } from '@/components/charts/PerformanceChart'
import { TradeHistory } from '@/components/tables/TradeHistory'
import { useState, useEffect } from 'react';

interface ChartData {
  timestamp: string;
  value: number;
}

export default function Performance() {
  const [performanceData, setPerformanceData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        const response = await fetch('/api/portfolio-metrics');
        if (!response.ok) throw new Error('Failed to fetch performance data');
        const data = await response.json();
        setPerformanceData(data.history || []);
      } catch (error) {
        console.error('Error fetching performance data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformanceData();
  }, []);

  return (
    <main className="min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-8">Performance & Analytics</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Historical Performance</h2>
        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <PerformanceChart data={performanceData} />
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Key Metrics</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="metric-card">
            <h3>Total Return</h3>
            <p className="text-2xl">XX%</p>
          </div>
          <div className="metric-card">
            <h3>Win Rate</h3>
            <p className="text-2xl">XX%</p>
          </div>
          <div className="metric-card">
            <h3>Sharpe Ratio</h3>
            <p className="text-2xl">X.XX</p>
          </div>
          <div className="metric-card">
            <h3>Max Drawdown</h3>
            <p className="text-2xl">XX%</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Recent Trades</h2>
        <TradeHistory />
      </section>
    </main>
  )
}
