'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

export function StrategyDocs() {
  const [content, setContent] = useState('');

  useEffect(() => {
    // This would fetch your strategy markdown files
    const fetchStrategy = async () => {
      try {
        const response = await fetch('/api/strategy');
        const data = await response.json();
        setContent(data.content);
      } catch (error) {
        console.error('Failed to fetch strategy docs:', error);
        setContent('# Error loading strategy documentation');
      }
    };

    fetchStrategy();
  }, []);

  return (
    <div className="prose prose-invert prose-gold max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
