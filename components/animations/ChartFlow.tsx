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
}

export function ChartFlow() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [lastPrice, setLastPrice] = useState(100);

  const generateCandle = (id: number, prevClose: number): Candle => {
    // Le open est TOUJOURS égal au close précédent
    const open = prevClose;
    
    // Mouvement maximum de 2% par rapport au prix précédent
    const maxMove = prevClose * 0.02;
    const moveAmount = Math.random() * maxMove;
    const direction = Math.random() > 0.5 ? 1 : -1;
    const close = prevClose + (direction * moveAmount);
    
    // Générer les mèches proportionnellement au corps
    const bodyRange = Math.abs(close - open);
    const wickSize = bodyRange * 0.5;
    
    const high = Math.max(open, close) + (Math.random() * wickSize);
    const low = Math.min(open, close) - (Math.random() * wickSize);

    return {
      id,
      open: prevClose,
      high,
      low, 
      close,
      color: close >= prevClose ? '#22c55e' : '#ef4444'
    };
  };

  useEffect(() => {
    // Initialiser avec un prix de départ
    const initialCandles = [];
    let currentPrice = lastPrice;
    
    for (let i = 0; i < 20; i++) {
      const candle = generateCandle(i, currentPrice);
      initialCandles.push(candle);
      currentPrice = candle.close; // Utiliser le close comme prix pour la prochaine bougie
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

  const maxPrice = Math.max(...candles.map(c => c.high));
  const minPrice = Math.min(...candles.map(c => c.low));
  const priceRange = maxPrice - minPrice;

  return (
    <div className="w-full h-[400px] bg-black/50 rounded-lg p-4">
      <div className="h-full flex items-end space-x-2">
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
                {/* Mèche avec la même couleur que le corps */}
                <div
                  className="absolute w-[1px] left-1/2 transform -translate-x-1/2"
                  style={{ 
                    height: '100%',
                    backgroundColor: candle.color
                  }}
                />
                {/* Corps */}
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
    </div>
  );
}
