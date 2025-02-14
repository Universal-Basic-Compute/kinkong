'use client';

import { useEffect, useState } from 'react';

interface Thought {
  thoughtId: string;
  swarmId: string;
  content: string;
  createdAt: string;
}

export function StrategyThoughts() {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchThoughts = async () => {
      try {
        const response = await fetch('/api/thoughts');
        if (!response.ok) throw new Error('Failed to fetch thoughts');
        const data = await response.json();
        setThoughts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch thoughts');
      } finally {
        setLoading(false);
      }
    };

    fetchThoughts();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-pulse text-gold text-lg">Loading KinKong's thoughts...</div>
    </div>
  );
  
  if (error) return (
    <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4 text-red-400">
      Error: {error}
    </div>
  );

  return (
    <div className="bg-black/40 rounded-lg border border-gold/20 p-6 backdrop-blur-sm">
      <div className="space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar">
        {thoughts.map((thought) => (
          <div key={thought.thoughtId} className="flex justify-start group">
            <div className="max-w-[90%] rounded-lg p-5 bg-darkred/10 border border-gold/20 transition-all duration-200 hover:border-gold/40 hover:bg-darkred/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-gold font-medium">KinKong</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold/80">
                    AI Trader
                  </span>
                </div>
                <span className="text-gray-500 text-sm">
                  {new Date(thought.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                {thought.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
