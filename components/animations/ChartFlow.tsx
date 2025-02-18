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
    const maxMove = prevClose * 0.03;
    const moveAmount = Math.random() * maxMove;
    
    const direction = prevClose > lastPrice ? 
      (Math.random() > 0.8 ? 1 : -1) : 
      (Math.random() > 0.2 ? 1 : -1);  
      
    const close = prevClose + (direction * moveAmount);
    
    // Nouvelle logique pour des mèches plus variées et souvent plus courtes
    const bodyRange = Math.abs(close - prevClose);
    
    // 30% de chance de n'avoir aucune mèche
    const hasWicks = Math.random() > 0.3;
    
    if (!hasWicks) {
      // Retourne une bougie sans mèches
      return {
        id,
        open: prevClose,
        close,
        high: Math.max(prevClose, close),
        low: Math.min(prevClose, close),
        color: close >= prevClose ? '#22c55e' : '#ef4444'
      };
    }
    
    // Pour les bougies avec mèches
    const getWickSize = () => {
      const random = Math.random();
      return bodyRange * (0.1 + (random * random) * 1.2);
    };

    const upperWickSize = getWickSize();
    const lowerWickSize = getWickSize();
    
    // 20% de chance d'avoir une mèche longue
    const hasLongWick = Math.random() > 0.8;
    if (hasLongWick) {
      if (Math.random() > 0.5) {
        upperWickSize * 2.5;
      } else {
        lowerWickSize * 2.5;
      }
    }
    
    const high = Math.max(prevClose, close) + upperWickSize;
    const low = Math.min(prevClose, close) - lowerWickSize;

    setLastPrice(prevClose);

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
    }, 444); // 666ms / 1.5 = 444ms pour speed x1.5

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-[400px] bg-black/50 rounded-lg p-4">
      <div className="h-[67%] flex items-end space-x-1">
        <AnimatePresence>
          {candles.map((candle) => {
            // Calculer les hauteurs relatives
            const highest = Math.max(...candles.map(c => c.high));
            const lowest = Math.min(...candles.map(c => c.low));
            const priceRange = highest - lowest;

            // Calculer les positions relatives en pourcentage
            const highPercent = ((candle.high - lowest) / priceRange) * 100;
            const lowPercent = ((candle.low - lowest) / priceRange) * 100;
            const openPercent = ((candle.open - lowest) / priceRange) * 100;
            const closePercent = ((candle.close - lowest) / priceRange) * 100;

            // Calculer la hauteur et la position du corps
            const bodyHeight = Math.abs(closePercent - openPercent);
            const bodyBottom = Math.min(closePercent, openPercent);
            
            // Calculer la hauteur totale de la bougie (mèches incluses)
            const wickHeight = highPercent - lowPercent;
            const wickBottom = lowPercent;

            return (
              <motion.div
                key={candle.id}
                className="relative w-3 h-full"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Mèche */}
                <div 
                  className="absolute w-[1px] left-1/2 -translate-x-1/2"
                  style={{
                    backgroundColor: candle.color,
                    height: `${wickHeight}%`,
                    bottom: `${wickBottom}%`
                  }}
                />
                {/* Corps */}
                <div 
                  className="absolute w-full"
                  style={{
                    backgroundColor: candle.color,
                    height: `${bodyHeight}%`,
                    bottom: `${bodyBottom}%`
                  }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
