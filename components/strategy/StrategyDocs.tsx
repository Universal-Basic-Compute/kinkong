'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

export function StrategyDocs() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStrategy = async () => {
      try {
        const response = await fetch('/api/strategy');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setContent(data.content);
      } catch (err) {
        console.error('Failed to fetch strategy docs:', err);
        setError(err instanceof Error ? err.message : 'Failed to load documentation');
      } finally {
        setLoading(false);
      }
    };

    fetchStrategy();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse text-gold">
        Loading strategy documentation...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 bg-red-900/20 p-4 rounded-lg border border-red-500/20">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown>{content || '# Strategy documentation not available'}</ReactMarkdown>
    </div>
  );
}
