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
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatValue = (value: number) => {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/90 border border-gold/20 p-3 rounded-lg">
          <p className="text-gray-400">{formatDate(label)}</p>
          <p className="text-gold font-bold">
            {formatValue(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart 
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
      >
        <XAxis 
          dataKey="timestamp" 
          tickFormatter={formatDate}
          stroke="#666"
          tick={{ fill: '#666' }}
          tickLine={{ stroke: '#666' }}
        />
        <YAxis 
          tickFormatter={formatValue}
          stroke="#666"
          tick={{ fill: '#666' }}
          tickLine={{ stroke: '#666' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke="#FFD700" 
          name="Portfolio Value"
          dot={false}
          strokeWidth={2}
          activeDot={{ 
            r: 6, 
            fill: '#FFD700',
            stroke: '#000',
            strokeWidth: 2
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
