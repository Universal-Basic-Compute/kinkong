'use client';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
}

export function StrategyThoughts() {
  // This would be replaced with real data from your backend
  const messages: Message[] = [
    {
      role: 'assistant',
      content: "I have been analyzing the AI token market structure. Notable increase in liquidity across major pairs.",
      timestamp: '2024-01-20T10:00:00Z'
    },
    {
      role: 'user',
      content: "What's your view on market direction?",
      timestamp: '2024-01-20T10:01:00Z'
    },
    {
      role: 'assistant',
      content: "Bullish bias confirmed. Key metrics: rising volume, decreasing volatility, stable SOL correlation.",
      timestamp: '2024-01-20T10:02:00Z'
    }
  ];

  return (
    <div className="bg-black/40 rounded-lg border border-gold/20 p-6">
      <div className="space-y-4">
        {messages.map((message, index) => (
          <div 
            key={index}
            className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
          >
            <div 
              className={`
                max-w-[80%] rounded-lg p-4
                ${message.role === 'assistant' 
                  ? 'bg-darkred/20 border border-gold/20' 
                  : 'bg-gold/10 border border-gold/20'}
              `}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gold font-medium">
                  {message.role === 'assistant' ? 'KinKong' : 'User'}
                </span>
                <span className="text-gray-400 text-sm">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-gray-200">{message.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
