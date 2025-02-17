'use client';
import { useEffect, useState } from 'react';

interface PortfolioMetrics {
  totalValue: number;
  change24h: number;
  change7d: number;
  history: Array<{timestamp: string; value: number}>;
}

export function MetricsDisplay() {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string>('No data yet');

  useEffect(() => {
    const fetchMetrics = async () => {
      console.log('🔍 Starting metrics fetch...');
      try {
        const response = await fetch('/api/portfolio-metrics');
        console.log('📡 API Response status:', response.status);
        
        // Get the raw response text
        const rawText = await response.text();
        setRawResponse(rawText);
        
        // Parse the JSON after getting raw text
        const data = JSON.parse(rawText);
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

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold mb-4">Raw Response:</h3>
      <pre className="bg-black/30 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
        {rawResponse}
      </pre>
    </div>
  );
}
