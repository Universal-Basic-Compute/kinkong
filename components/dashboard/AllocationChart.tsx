'use client';

'use client';
import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  usdValue?: number;
}

const COLORS = ['#FFD700', '#8B0000', '#4B0082', '#006400', '#800000', '#483D8B', '#8B4513'];

export function AllocationChart() {
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const response = await fetch('/api/portfolio');
        if (!response.ok) {
          throw new Error('Failed to fetch portfolio data');
        }
        const data = await response.json();
        setTokens(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load portfolio');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  if (isLoading) {
    return <div className="text-center py-4">Loading allocation data...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-400">Error: {error}</div>;
  }

  const totalValue = tokens.reduce((sum, token) => sum + (token.usdValue || 0), 0);
  
  const chartData = tokens
    .filter(token => token.usdValue && token.usdValue > 0)
    .map(token => ({
      name: token.symbol || token.mint.slice(0, 4),
      value: token.usdValue || 0,
      percentage: ((token.usdValue || 0) / totalValue * 100).toFixed(1)
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="h-[300px] w-full bg-black/50 rounded-lg p-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percentage }) => `${name} (${percentage}%)`}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]}
                className="hover:opacity-80 transition-opacity"
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => `$${value.toLocaleString(undefined, {
              maximumFractionDigits: 2
            })}`}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
