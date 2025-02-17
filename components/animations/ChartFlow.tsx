'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Candle {
  id: number;
  open: number;
  close: number;
  high: number;
  low: number;
  color: string;
}

export function ChartFlow() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [lastPrice, setLastPrice] = useState(100);

  const generateCandle = (id: number, prevClose: number): Candle => {
    const maxMove = prevClose * 0.02; // 2% max movement
    const moveAmount = Math.random() * maxMove;
    
    // If previous candle was bullish (close higher than open)
    // then next candle has higher chance of being bearish
    const direction = prevClose > lastPrice ? 
      (Math.random() > 0.8 ? 1 : -1) : // 20% chance to continue up
      (Math.random() > 0.2 ? 1 : -1);  // 80% chance to go up
      
    const close = prevClose + (direction * moveAmount);
    
    // Generate wicks
    const bodyRange = Math.abs(close - prevClose);
    const wickSize = bodyRange * 0.5;
    const high = Math.max(prevClose, close) + (Math.random() * wickSize);
    const low = Math.min(prevClose, close) - (Math.random() * wickSize);

    setLastPrice(prevClose); // Keep track of last price for trend

    return {
      id,
      open: prevClose,
      close,
      high,
      low,
      color: close >= prevClose ? '#22c55e' : '#ef4444'
    };
  };

  useEffect(() => {
    const initialCandles = [];
    let currentPrice = lastPrice;
    
    for (let i = 0; i < 20; i++) {
      const candle = generateCandle(i, currentPrice);
      initialCandles.push(candle);
      currentPrice = candle.close;
    }

    setCandles(initialCandles);
    setLastPrice(currentPrice);

    const interval = setInterval(() => {
      setCandles(prev => {
        const newCandle = generateCandle(prev[prev.length - 1].id + 1, prev[prev.length - 1].close);
        return [...prev.slice(1), newCandle];
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-[400px] bg-black/50 rounded-lg p-4">
      <div className="h-full flex items-end space-x-2">
        <AnimatePresence>
          {candles.map((candle) => (
            <motion.div
              key={candle.id}
              className="relative w-4 h-full flex flex-col justify-center"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
            >
              {/* Wick */}
              <div 
                className="absolute w-[2px] left-1/2 -translate-x-1/2"
                style={{
                  backgroundColor: candle.color,
                  height: '100%'
                }}
              />
              {/* Body */}
              <div 
                className="absolute w-full"
                style={{
                  backgroundColor: candle.color,
                  height: '60%'
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
