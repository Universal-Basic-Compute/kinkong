'use client';
import { useEffect, useState } from 'react';

interface PortfolioMetrics {
  totalValue: number;
  change24h: number;
  change7d: number;
  history: Array<{timestamp: string; value: number}>;
}

export function MetricsDisplay() {
  console.log('🚨 METRICS DISPLAY COMPONENT MOUNTED 🚨');
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      console.log('🔍 Starting metrics fetch...');
      try {
        const response = await fetch('/api/portfolio-metrics');
        console.log('📡 API Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 Metrics data:', data);
        setMetrics(data);
      } catch (error) {
        console.error('❌ Error fetching metrics:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoading(false);
        console.log('✅ Metrics fetch complete');
      }
    };

    console.log('🏁 Initializing metrics component');
    fetchMetrics();
  }, []);

  console.log('Current state:', { metrics, isLoading, error });

  const metricsData = [
    { 
      label: "Portfolio Value", 
      value: isLoading ? "Loading..." : metrics ? `$${metrics.totalValue.toLocaleString(undefined, {
        maximumFractionDigits: 2
      })}` : "$0.00",
      unit: "Total Assets" 
    },
    { 
      label: "24h Change", 
      value: metrics ? `${metrics.change24h >= 0 ? '+' : ''}${metrics.change24h.toFixed(2)}%` : "+0.00%", 
      unit: "Daily Performance" 
    },
    { 
      label: "7d Performance", 
      value: metrics ? `${metrics.change7d >= 0 ? '+' : ''}${metrics.change7d.toFixed(2)}%` : "+0.00%", 
      unit: "Weekly Return" 
    }
  ];

  if (error) {
    console.error('❌ Rendering error state:', error);
    return <div className="text-red-500">Error loading metrics: {error}</div>;
  }

  console.log('🎨 Rendering metrics:', metricsData);
  return (
    <>
      {metricsData.map((metric, i) => (
        <div key={i} className="metric p-6 rounded-lg metallic-surface border border-gold/10 text-center transition-all hover-effect">
          <h4 className="text-gray-300 mb-2">{metric.label}</h4>
          <p className="text-4xl font-bold text-gold mb-1">{metric.value}</p>
          <p className="text-sm text-gray-400">{metric.unit}</p>
        </div>
      ))}
    </>
  );
}
