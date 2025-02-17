'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Candle {
  id: number;
  open: number;
  high: number;
  low: number;
  close: number;
  color: string;
  trend: number; // Trend strength and direction
  volatility: number;
}

export function ChartFlow() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [lastPrice, setLastPrice] = useState(100);
  const [trend, setTrend] = useState(0); // Current market trend
  const [volatility, setVolatility] = useState(0.5); // Current market volatility

  // Generate a new random candle
  const generateCandle = (id: number, prevClose: number, prevTrend: number, prevVolatility: number): Candle => {
    // Update trend with mean reversion
    const newTrend = prevTrend * 0.95 + (Math.random() - 0.5) * 0.3;
    
    // Update volatility with mean reversion
    const newVolatility = prevVolatility * 0.95 + Math.random() * 0.1;
    
    // Calculate price change based on trend and volatility
    const trendChange = newTrend * 2; // Trend influence
    const randomChange = (Math.random() - 0.5) * newVolatility * 10; // Random noise
    const totalChange = trendChange + randomChange;
    
    const close = prevClose * (1 + totalChange / 100);
    
    // Generate realistic high/low based on volatility
    const wickRange = prevClose * (newVolatility / 10);
    const high = Math.max(close, prevClose) + (Math.random() * wickRange);
    const low = Math.min(close, prevClose) - (Math.random() * wickRange);

    return {
      id,
      open: prevClose,
      high,
      low,
      close,
      color: close >= prevClose ? '#22c55e' : '#ef4444',
      trend: newTrend,
      volatility: newVolatility
    };
  };

  useEffect(() => {
    // Generate initial candles with trending behavior
    const initialCandles = [];
    let currentPrice = lastPrice;
    let currentTrend = trend;
    let currentVolatility = volatility;

    for (let i = 0; i < 20; i++) {
      const candle = generateCandle(i, currentPrice, currentTrend, currentVolatility);
      initialCandles.push(candle);
      currentPrice = candle.close;
      currentTrend = candle.trend;
      currentVolatility = candle.volatility;
    }

    setCandles(initialCandles);
    setLastPrice(currentPrice);
    setTrend(currentTrend);
    setVolatility(currentVolatility);

    // Periodically add new candles
    const interval = setInterval(() => {
      setCandles(prev => {
        const lastCandle = prev[prev.length - 1];
        const newCandle = generateCandle(
          lastCandle.id + 1,
          lastCandle.close,
          lastCandle.trend,
          lastCandle.volatility
        );
        
        setLastPrice(newCandle.close);
        setTrend(newCandle.trend);
        setVolatility(newCandle.volatility);
        
        return [...prev.slice(1), newCandle];
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculate dynamic price range with padding
  const maxPrice = Math.max(...candles.map(c => c.high)) * 1.01;
  const minPrice = Math.min(...candles.map(c => c.low)) * 0.99;
  const priceRange = maxPrice - minPrice;

  // Calculate price change percentage
  const priceChange = candles.length >= 2 
    ? ((lastPrice - candles[candles.length - 2].close) / candles[candles.length - 2].close) * 100
    : 0;

  return (
    <div className="w-full h-[400px] bg-black/50 rounded-lg p-4 relative">
      {/* Price Scale */}
      <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between text-sm text-gray-400 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i}>
            ${(maxPrice - (priceRange * (i / 4))).toFixed(2)}
          </span>
        ))}
      </div>

      {/* Candles */}
      <div className="ml-16 h-full flex items-end space-x-2">
        <AnimatePresence>
          {candles.map((candle) => {
            const height = ((candle.high - candle.low) / priceRange) * 100;
            const bottom = ((candle.low - minPrice) / priceRange) * 100;
            const bodyHeight = Math.abs(candle.close - candle.open) / priceRange * 100;
            const bodyBottom = ((Math.min(candle.open, candle.close) - minPrice) / priceRange) * 100;

            return (
              <motion.div
                key={candle.id}
                className="relative w-4"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5 }}
                style={{ height: `${height}%`, marginBottom: `${bottom}%` }}
              >
                {/* Wick */}
                <div
                  className="absolute w-[1px] left-1/2 transform -translate-x-1/2 bg-gray-400"
                  style={{ height: '100%' }}
                />
                {/* Body */}
                <motion.div
                  className="absolute w-full"
                  style={{
                    height: `${bodyHeight}%`,
                    bottom: `${bodyBottom - bottom}%`,
                    backgroundColor: candle.color
                  }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Market Info */}
      <div className="absolute top-2 right-2 text-right">
        <div className="text-xl font-bold">
          <span className={priceChange >= 0 ? 'text-green-500' : 'text-red-500'}>
            ${lastPrice.toFixed(2)}
          </span>
        </div>
        <div className={`text-sm ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
