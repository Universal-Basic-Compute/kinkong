'use client';

interface Signal {
  id: number;
  timestamp: string;
  token: string;
  type: 'BUY' | 'SELL';
  wallet: string;
  reason?: string;
  url?: string;
}

export function SignalHistory() {
  // Mock data - replace with real data later
  const mockSignals: Signal[] = [
    {
      id: 1,
      timestamp: '2024-01-20 14:30',
      token: 'AI_TOKEN1',
      type: 'BUY',
      wallet: 'KinKong',
      reason: 'Strong momentum indicators and increasing volume',
      url: 'https://twitter.com/example/status/123'
    },
    {
      id: 2,
      timestamp: '2024-01-20 15:45',
      token: 'AI_TOKEN2',
      type: 'SELL',
      wallet: 'Gx7F...j9k2',
      reason: 'Technical resistance reached',
      url: 'https://discord.com/channels/123/456'
    },
    {
      id: 3,
      timestamp: '2024-01-20 16:15',
      token: 'SOL',
      type: 'BUY',
      wallet: 'KinKong',
      reason: 'Market structure showing reversal signs',
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
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">From</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Reason</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gold uppercase tracking-wider">Reference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gold/10">
          {mockSignals.map((signal) => (
            <tr key={signal.id} className="hover:bg-gold/5">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {signal.timestamp}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {signal.token}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  signal.type === 'BUY' 
                    ? 'bg-green-900/50 text-green-400' 
                    : 'bg-red-900/50 text-red-400'
                }`}>
                  {signal.type}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`text-sm ${
                  signal.wallet === 'KinKong' 
                    ? 'text-gold font-semibold' 
                    : 'text-gray-300'
                }`}>
                  {signal.wallet}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {signal.reason || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {signal.url ? (
                  <a 
                    href={signal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold hover:text-gold/80 underline"
                  >
                    View
                  </a>
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
