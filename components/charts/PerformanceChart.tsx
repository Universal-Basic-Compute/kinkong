'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartData {
  timestamp: string;
  value: number;
}

interface PerformanceChartProps {
  data: ChartData[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const formatValue = (value: number) => {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <XAxis 
          dataKey="timestamp" 
          tickFormatter={formatDate}
          stroke="#666"
        />
        <YAxis 
          tickFormatter={formatValue}
          stroke="#666"
        />
        <Tooltip 
          formatter={(value: number) => formatValue(value)}
          labelFormatter={(label: string) => formatDate(label)}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke="#FFD700" 
          name="Portfolio Value"
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
