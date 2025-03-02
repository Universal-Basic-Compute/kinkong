'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface WhaleDistributionChartProps {
  data: any[];
  isLoading: boolean;
}

export function WhaleDistributionChart({ data, isLoading }: WhaleDistributionChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    
    // Count whales by holding pattern
    const holdingPatterns = data.reduce((acc, item) => {
      const pattern = item.holdingPattern || 'UNKNOWN';
      acc[pattern] = (acc[pattern] || 0) + 1;
      return acc;
    }, {});
    
    // Convert to array format for chart
    return Object.entries(holdingPatterns).map(([name, value]) => ({
      name,
      value
    }));
  }, [data]);
  
  const COLORS = ['#4CAF50', '#FFC107', '#F44336', '#9C27B0', '#2196F3'];
  
  if (isLoading) {
    return (
      <div className="bg-black/30 p-6 rounded-lg border border-gold/20 animate-pulse h-80">
        <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="h-64 bg-gray-700/20 rounded"></div>
      </div>
    );
  }
  
  return (
    <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
      <h3 className="text-xl font-bold mb-4">Whale Holding Patterns</h3>
      <div className="h-80">
        {chartData.length > 0 ? (
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
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} whales`, 'Count']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400">No data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
