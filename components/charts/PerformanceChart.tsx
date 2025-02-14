'use client'
'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts'

export function PerformanceChart() {
  // Mock data - will be replaced with real API data
  const data = [
    { date: '2024-01-01', value: 100, sol: 100, aiIndex: 100 },
    { date: '2024-01-02', value: 105, sol: 102, aiIndex: 103 },
    // ... more data points
  ]

  return (
    <LineChart width={800} height={400} data={data}>
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="value" stroke="#8884d8" name="KinKong" />
      <Line type="monotone" dataKey="sol" stroke="#82ca9d" name="SOL" />
      <Line type="monotone" dataKey="aiIndex" stroke="#ffc658" name="AI Index" />
    </LineChart>
  )
}
