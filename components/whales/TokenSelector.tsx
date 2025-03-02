import { useState, useEffect } from 'react';

interface TokenSelectorProps {
  selectedToken: string;
  onTokenChange: (token: string) => void;
}

export function TokenSelector({ selectedToken, onTokenChange }: TokenSelectorProps) {
  const [tokens, setTokens] = useState<string[]>(['ALL', 'UBC', 'COMPUTE']);
  
  useEffect(() => {
    // Optionally fetch available tokens from API
    async function fetchTokens() {
      try {
        const response = await fetch('/api/tokens');
        if (response.ok) {
          const data = await response.json();
          setTokens(['ALL', ...data.map(t => t.token)]);
        }
      } catch (error) {
        console.error('Error fetching tokens:', error);
      }
    }
    
    // Uncomment to fetch tokens dynamically
    // fetchTokens();
  }, []);
  
  return (
    <div className="flex items-center space-x-2">
      <span className="text-gray-400">Token:</span>
      <div className="flex space-x-2">
        {tokens.map(token => (
          <button
            key={token}
            onClick={() => onTokenChange(token)}
            className={`px-4 py-2 rounded-lg ${
              selectedToken === token 
                ? 'bg-gold/20 border border-gold text-white' 
                : 'bg-black/20 border border-gray-700 text-gray-400'
            }`}
          >
            {token === 'ALL' ? 'All Tokens' : token}
          </button>
        ))}
      </div>
    </div>
  );
}
