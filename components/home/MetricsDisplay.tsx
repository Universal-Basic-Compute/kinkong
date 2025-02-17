'use client';
import { useEffect, useState } from 'react';

export function MetricsDisplay() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        console.log('Fetching metrics data...');
        const response = await fetch('/api/portfolio-metrics');
        console.log('Response status:', response.status);
        
        const text = await response.text();
        console.log('Raw response:', text);

        if (text) {
          const json = JSON.parse(text);
          console.log('Parsed data:', json);
          setData(json);
        }
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-full p-4 bg-black/30 rounded-lg">
      <h2 className="text-xl mb-4">Portfolio Metrics</h2>
      <pre className="overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
