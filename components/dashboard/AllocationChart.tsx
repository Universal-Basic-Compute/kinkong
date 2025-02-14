'use client';

'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#FFD700', '#8B0000', '#4B0082', '#006400', '#800000'];

const mockData = [
  { name: 'AI Token 1', value: 30 },
  { name: 'AI Token 2', value: 25 },
  { name: 'SOL', value: 20 },
  { name: 'USDC', value: 15 },
  { name: 'Other', value: 10 },
];

export function AllocationChart() {
  return (
    <div className="h-[300px] w-full bg-black/50 rounded-lg p-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={mockData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {mockData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
