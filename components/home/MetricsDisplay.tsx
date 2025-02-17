'use client';
import { useEffect, useState } from 'react';

interface TokenBalance {
  mint: string;
  uiAmount: number;
  usdValue?: number;
}

export function MetricsDisplay() {
  const [totalValue, setTotalValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const response = await fetch('/api/portfolio');
        if (!response.ok) throw new Error('Failed to fetch portfolio data');
        const data: TokenBalance[] = await response.json();
        
        const total = data.reduce((sum, token) => sum + (token.usdValue || 0), 0);
        setTotalValue(total);
      } catch (error) {
        console.error('Error fetching portfolio:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  const metrics = [
    { 
      label: "Portfolio Value", 
      value: isLoading ? "Loading..." : `$${totalValue.toLocaleString(undefined, {
        maximumFractionDigits: 2
      })}`,
      unit: "Total Assets" 
    },
    { 
      label: "Profit Share", 
      value: "75%", 
      unit: "Weekly Distribution" 
    },
    { 
      label: "Min Investment", 
      value: "500", 
      unit: "USDC" 
    }
  ];

  return (
    <>
      {metrics.map((metric, i) => (
        <div key={i} className="metric p-6 rounded-lg metallic-surface border border-gold/10 text-center transition-all hover-effect">
          <h4 className="text-gray-300 mb-2">{metric.label}</h4>
          <p className="text-4xl font-bold text-gold mb-1">{metric.value}</p>
          <p className="text-sm text-gray-400">{metric.unit}</p>
        </div>
      ))}
    </>
  );
}
