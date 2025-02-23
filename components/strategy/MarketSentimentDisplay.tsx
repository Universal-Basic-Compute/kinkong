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
        console.log('Raw data from API:', data);
        setSentiment(data);
        
        // Parse the indicators JSON string
        if (data.indicators) {
          console.log('Raw indicators string:', data.indicators);
          const parsed = JSON.parse(data.indicators);
          console.log('Parsed indicators:', parsed);
          console.log('Relative strength:', parsed.relative_strength);
          setParsedIndicators(parsed);
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
          <div className="relative overflow-hidden rounded-xl bg-black/20 p-6 border border-gray-800 hover:border-gray-700 transition-all group hover:bg-black/30">
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-sm text-gray-400 mb-2">SOL Performance</div>
              <div className={`text-2xl font-bold ${
                (parsedIndicators?.relative_strength?.sol_performance ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {(parsedIndicators?.relative_strength?.sol_performance ?? 0) >= 0 ? '+' : ''}
                {(parsedIndicators?.relative_strength?.sol_performance ?? 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-300 mt-1">
                7-Day Return
              </div>
            </div>
          </div>

          {/* AI Performance */}
          <div className="relative overflow-hidden rounded-xl bg-black/20 p-6 border border-gray-800 hover:border-gray-700 transition-all group hover:bg-black/30">
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-sm text-gray-400 mb-2">AI Tokens Performance</div>
              <div className={`text-2xl font-bold ${
                (parsedIndicators?.relative_strength?.ai_tokens_performance ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {(parsedIndicators?.relative_strength?.ai_tokens_performance ?? 0) >= 0 ? '+' : ''}
                {(parsedIndicators?.relative_strength?.ai_tokens_performance ?? 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-300 mt-1">
                7-Day Return
              </div>
            </div>
          </div>
        </motion.div>

        {/* Detailed Indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-5 gap-6 mt-8"
        >
          {/* Price Action */}
          <div className="relative rounded-xl bg-black/20 p-4 border border-gray-800 hover:border-gray-700 transition-all group hover:bg-black/30">
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                Price Action
                <div className="group relative">
                  <div className="cursor-help text-gray-500 hover:text-gray-300">ⓘ</div>
                  <div className="invisible group-hover:visible absolute bottom-6 left-1/2 transform -translate-x-1/2 w-64 p-2 bg-black/90 border border-gray-700 text-xs text-gray-300 rounded-lg z-50">
                    {parsedIndicators?.price_action?.info}
                  </div>
                </div>
              </div>
              <div className={`text-xl font-bold ${
                parsedIndicators?.price_action?.is_bullish ?? false ? 'text-green-400' : 'text-red-400'
              }`}>
                {(parsedIndicators?.price_action?.percentage ?? 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-300 mt-1">
                Above Average
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {parsedIndicators?.price_action?.tokens_above_avg}/{parsedIndicators?.price_action?.total_tokens} tokens
              </div>
            </div>
          </div>

          {/* Volume Analysis */}
          <div className="relative rounded-xl bg-black/20 p-4 border border-gray-800 hover:border-gray-700 transition-all group hover:bg-black/30">
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                Volume Trend
                <div className="group relative">
                  <div className="cursor-help text-gray-500 hover:text-gray-300">ⓘ</div>
                  <div className="invisible group-hover:visible absolute bottom-6 left-1/2 transform -translate-x-1/2 w-64 p-2 bg-black/90 border border-gray-700 text-xs text-gray-300 rounded-lg z-50">
                    {parsedIndicators?.volume?.info}
                  </div>
                </div>
              </div>
              <div className={`text-xl font-bold ${
                (parsedIndicators?.volume?.growth ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {(parsedIndicators?.volume?.growth ?? 0) >= 0 ? '+' : ''}
                {(parsedIndicators?.volume?.growth ?? 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-300 mt-1">
                7-Day Growth
              </div>
            </div>
          </div>

          {/* Position Signals */}
          <div className="relative rounded-xl bg-black/20 p-4 border border-gray-800 hover:border-gray-700 transition-all group hover:bg-black/30">
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                Position Signals
                <div className="group relative">
                  <div className="cursor-help text-gray-500 hover:text-gray-300">ⓘ</div>
                  <div className="invisible group-hover:visible absolute bottom-6 left-1/2 transform -translate-x-1/2 w-64 p-2 bg-black/90 border border-gray-700 text-xs text-gray-300 rounded-lg z-50">
                    {parsedIndicators?.position_signals?.info}
                  </div>
                </div>
              </div>
              <div className={`text-xl font-bold ${
                (parsedIndicators?.position_signals?.buy_percentage ?? 0) >= 50 ? 'text-green-400' : 'text-red-400'
              }`}>
                {(parsedIndicators?.position_signals?.buy_percentage ?? 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-300 mt-1">
                Buy Signals
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {parsedIndicators?.position_signals?.buy_signals}/{parsedIndicators?.position_signals?.total_signals} total
              </div>
            </div>
          </div>

          {/* Relative Strength */}
          <div className="relative rounded-xl bg-black/20 p-4 border border-gray-800 hover:border-gray-700 transition-all group hover:bg-black/30">
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                AI vs SOL
                <div className="group relative">
                  <div className="cursor-help text-gray-500 hover:text-gray-300">ⓘ</div>
                  <div className="invisible group-hover:visible absolute bottom-6 left-1/2 transform -translate-x-1/2 w-64 p-2 bg-black/90 border border-gray-700 text-xs text-gray-300 rounded-lg z-50">
                    {parsedIndicators?.relative_strength?.info}
                  </div>
                </div>
              </div>
              <div className={`text-xl font-bold ${
                parsedIndicators?.relative_strength?.is_bullish ?? false ? 'text-green-400' : 'text-red-400'
              }`}>
                {(parsedIndicators?.relative_strength?.ai_tokens_performance ?? 0) >= 0 ? '+' : ''}
                {(parsedIndicators?.relative_strength?.ai_tokens_performance ?? 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-300 mt-1">
                Outperformance
              </div>
            </div>
          </div>

          {/* Market Structure */}
          <div className="relative rounded-xl bg-black/20 p-4 border border-gray-800 hover:border-gray-700 transition-all group hover:bg-black/30">
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                Confidence
                <div className="group relative">
                  <div className="cursor-help text-gray-500 hover:text-gray-300">ⓘ</div>
                  <div className="invisible group-hover:visible absolute bottom-6 left-1/2 transform -translate-x-1/2 w-64 p-2 bg-black/90 border border-gray-700 text-xs text-gray-300 rounded-lg z-50">
                    Overall confidence score based on the alignment and strength of all market indicators.
                  </div>
                </div>
              </div>
              <div className="text-xl font-bold text-gold">
                {sentiment?.confidence}%
              </div>
              <div className="text-xs text-gray-300 mt-1">
                Signal Strength
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
