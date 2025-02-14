'use client';

interface TradeHistoryProps {
  userOnly?: boolean;
}

export function TradeHistory({ userOnly = false }: TradeHistoryProps) {
  // Mock data - replace with real data later
  const mockTrades = [
    {
      id: 1,
      timestamp: '2024-01-20 14:30',
      token: 'AI_TOKEN1',
      type: 'BUY',
      amount: '1000',
      price: '2.45',
      status: 'SUCCESS'
    },
    {
      id: 2,
      timestamp: '2024-01-20 15:45',
      token: 'AI_TOKEN2',
      type: 'SELL',
      amount: '500',
      price: '3.12',
      status: 'SUCCESS'
    },
    {
      id: 3,
      timestamp: '2024-01-20 16:15',
      token: 'SOL',
      type: 'BUY',
      amount: '10',
      price: '95.30',
      status: 'SUCCESS'
    }
  ];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-black/50 rounded-lg">
        <thead>
          <tr className="border-b border-gold/20">
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Time</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Token</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Amount</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Price</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gold/10">
          {mockTrades.map((trade) => (
            <tr key={trade.id} className="hover:bg-gold/5">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{trade.timestamp}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{trade.token}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  trade.type === 'BUY' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                }`}>
                  {trade.type}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{trade.amount}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${trade.price}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  trade.status === 'SUCCESS' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                }`}>
                  {trade.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
