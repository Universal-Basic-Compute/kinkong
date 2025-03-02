'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface WhaleOutlookChartProps {
  data: any[];
  isLoading: boolean;
}

export function WhaleOutlookChart({ data, isLoading }: WhaleOutlookChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    
    // Group by token and count outlooks
    const tokenOutlooks = data.reduce((acc, item) => {
      const token = item.token || 'UNKNOWN';
      if (!acc[token]) {
        acc[token] = { token, BULLISH: 0, NEUTRAL: 0, BEARISH: 0 };
      }
      
      const outlook = item.outlook || 'NEUTRAL';
      acc[token][outlook] += 1;
      
      return acc;
    }, {});
    
    // Convert to array format for chart
    return Object.values(tokenOutlooks);
  }, [data]);
  
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
      <h3 className="text-xl font-bold mb-4">Whale Sentiment by Token</h3>
      <div className="h-80">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="token" />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`${value} whales`, 'Count']}
                contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }}
              />
              <Legend />
              <Bar dataKey="BULLISH" stackId="a" fill="#4CAF50" />
              <Bar dataKey="NEUTRAL" stackId="a" fill="#2196F3" />
              <Bar dataKey="BEARISH" stackId="a" fill="#F44336" />
            </BarChart>
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
