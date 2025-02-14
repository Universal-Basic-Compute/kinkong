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

  if (loading) return <div className="text-gold">Loading thoughts...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="bg-black/40 rounded-lg border border-gold/20 p-6">
      <div className="space-y-4">
        {thoughts.map((thought) => (
          <div key={thought.thoughtId} className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-4 bg-darkred/20 border border-gold/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gold font-medium">KinKong</span>
                <span className="text-gray-400 text-sm">
                  {new Date(thought.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-200">{thought.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
