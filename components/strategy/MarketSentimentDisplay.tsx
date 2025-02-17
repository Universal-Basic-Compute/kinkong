'use client';
import { useEffect, useState } from 'react';

interface MarketSentiment {
  classification: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  notes: string;
  weekEndDate: string;
  solPerformance: number;
  aiTokensPerformance: number;
}

export function MarketSentimentDisplay() {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSentiment() {
      try {
        const response = await fetch('/api/market-sentiment/latest');
        if (!response.ok) throw new Error('Failed to fetch sentiment');
        const data = await response.json();
        setSentiment(data);
      } catch (error) {
        console.error('Error fetching sentiment:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSentiment();
  }, []);

  if (isLoading) {
    return <div className="text-center py-8">Loading market sentiment...</div>;
  }

  if (!sentiment) {
    return <div className="text-center py-8 text-red-400">Failed to load market sentiment</div>;
  }

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'BULLISH':
        return 'text-green-400';
      case 'BEARISH':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-black/30 border border-gold/20 rounded-lg p-6 space-y-6">
      <div className="text-center">
        <div className="text-sm text-gray-400 mb-2">
          Market Sentiment as of {formatDate(sentiment.weekEndDate)}
        </div>
        <div className={`text-5xl font-bold ${getClassificationColor(sentiment.classification)} mb-2`}>
          {sentiment.classification}
        </div>
        <div className="text-xl text-gold">
          {sentiment.confidence}% Confidence
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-4 bg-black/20 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">SOL Performance</div>
          <div className={`text-xl font-bold ${sentiment.solPerformance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {sentiment.solPerformance > 0 ? '+' : ''}{sentiment.solPerformance.toFixed(1)}%
          </div>
        </div>
        <div className="text-center p-4 bg-black/20 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">AI Tokens Performance</div>
          <div className={`text-xl font-bold ${sentiment.aiTokensPerformance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {sentiment.aiTokensPerformance > 0 ? '+' : ''}{sentiment.aiTokensPerformance.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-400">Analysis:</div>
        {sentiment.notes.split('\n').map((note, index) => (
          <div key={index} className="text-gray-300 pl-4">
            {note}
          </div>
        ))}
      </div>
    </div>
  );
}
