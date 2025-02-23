'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface MarketSentiment {
  classification: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  notes: string;
  weekEndDate: string;
  indicators: string; // This is the JSON string containing all indicators
}

interface ParsedIndicators {
  relative_strength: {
    is_bullish: boolean;
    details: string;
    sol_performance: number;
    ai_tokens_performance: number;
  };
  price_action: {
    is_bullish: boolean;
    details: string;
    tokens_above_avg: number;
    total_tokens: number;
    percentage: number;
  };
  volume: {
    is_bullish: boolean;
    details: string;
    current: number;
    previous: number;
    growth: number;
  };
  distribution: {
    is_bullish: boolean;
    details: string;
    up_day_volume: number;
  };
  position_signals: {
    is_bullish: boolean;
    details: string;
    total_signals: number;
    buy_signals: number;
    buy_percentage: number;
  };
}

export function MarketSentimentDisplay() {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [parsedIndicators, setParsedIndicators] = useState<ParsedIndicators | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSentiment() {
      try {
        const response = await fetch('/api/market-sentiment/latest');
        if (!response.ok) throw new Error('Failed to fetch sentiment');
        const data = await response.json();
        setSentiment(data);
        
        // Parse the indicators JSON string
        if (data.indicators) {
          const parsed = JSON.parse(data.indicators);
          setParsedIndicators(parsed);
          console.log('Parsed indicators:', parsed); // Debug log
        }
        // Parse the indicators JSON string
        if (data.indicators) {
          setParsedIndicators(JSON.parse(data.indicators));
        }
      } catch (error) {
        console.error('Error fetching sentiment:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSentiment();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-pulse text-gold">
          Analyzing market sentiment...
        </div>
      </div>
    );
  }

  if (!sentiment) {
    return (
      <div className="flex items-center justify-center h-48 text-red-400">
        Failed to load market sentiment
      </div>
    );
  }

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'BULLISH':
        return {
          text: 'text-green-400',
          border: 'border-green-400/20',
          bg: 'bg-green-400/5',
          glow: 'shadow-green-400/20'
        };
      case 'BEARISH':
        return {
          text: 'text-red-400',
          border: 'border-red-400/20',
          bg: 'bg-red-400/5',
          glow: 'shadow-red-400/20'
        };
      default:
        return {
          text: 'text-yellow-400',
          border: 'border-yellow-400/20',
          bg: 'bg-yellow-400/5',
          glow: 'shadow-yellow-400/20'
        };
    }
  };

  const colors = getClassificationColor(sentiment.classification);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`
        relative overflow-hidden
        bg-black/40 backdrop-blur-sm
        border ${colors.border}
        rounded-2xl p-8
        shadow-lg ${colors.glow}
      `}
    >
      {/* Background Gradient */}
      <div 
        className={`
          absolute inset-0 opacity-10
          bg-gradient-to-br ${colors.bg}
          pointer-events-none
        `}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-gray-400 mb-4"
          >
            Market Sentiment as of {formatDate(sentiment.weekEndDate)}
          </motion.div>
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className={`
              text-6xl font-bold ${colors.text}
              tracking-tight mb-4
              animate-glow
            `}
          >
            {sentiment.classification}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="relative inline-block"
          >
            <div className={`
              text-2xl font-semibold
              bg-gradient-to-r from-gold/80 to-gold
              bg-clip-text text-transparent
            `}>
              {sentiment.confidence}% Confidence
            </div>
          </motion.div>
        </div>

        {/* Performance Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-2 gap-6 mb-8"
        >
          {/* SOL Performance */}
          <div className="relative overflow-hidden rounded-xl bg-black/20 p-6 group hover:bg-black/30 transition-all">
            <div className="text-sm text-gray-400 mb-2">SOL Performance</div>
            <div className={`text-2xl font-bold ${
              (parsedIndicators?.relative_strength?.sol_performance || 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {(parsedIndicators?.relative_strength?.sol_performance || 0) >= 0 ? '+' : ''}
              {parsedIndicators?.relative_strength?.sol_performance?.toFixed(1)}%
            </div>
          </div>

          {/* AI Performance */}
          <div className="relative overflow-hidden rounded-xl bg-black/20 p-6 group hover:bg-black/30 transition-all">
            <div className="text-sm text-gray-400 mb-2">AI Tokens Performance</div>
            <div className={`text-2xl font-bold ${
              (parsedIndicators?.relative_strength?.ai_tokens_performance || 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {(parsedIndicators?.relative_strength?.ai_tokens_performance || 0) >= 0 ? '+' : ''}
              {parsedIndicators?.relative_strength?.ai_tokens_performance?.toFixed(1)}%
            </div>
          </div>
        </motion.div>

        {/* Analysis Notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          <div className="text-sm font-medium text-gold mb-3">Analysis:</div>
          <div className="space-y-2 text-gray-300">
            {sentiment.notes.split('\n').map((note, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="flex items-start space-x-2 group"
              >
                <div className={`
                  mt-1.5 w-1.5 h-1.5 rounded-full
                  ${colors.bg} ${colors.border}
                  group-hover:scale-110 transition-transform
                `}/>
                <div className="flex-1">{note}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
