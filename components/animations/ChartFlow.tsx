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
  const [upperBand, setUpperBand] = useState<number[]>([]);
  const [lowerBand, setLowerBand] = useState<number[]>([]);

  const calculateBands = (candles: Candle[]) => {
    // Utiliser les high/low au lieu des close pour englober les bougies
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);
    
    const sma = closes.reduce((a, b) => a + b, 0) / closes.length;
    const time = Date.now() / 1000;
    
    // Facteur de respiration asymétrique
    const upperBreathing = Math.sin(time / 2) * 0.2 + 1.2; // varie entre 1 et 1.4
    const lowerBreathing = Math.sin(time / 2.5) * 0.15 + 1.1; // varie entre 0.95 et 1.25
    
    // Déviations asymétriques
    const upperDeviation = sma * 0.025 * upperBreathing; // 2.5% de base pour le haut
    const lowerDeviation = sma * 0.018 * lowerBreathing; // 1.8% de base pour le bas
    
    const upper = closes.map((close, i) => {
      const highestPoint = Math.max(highs[i], close);
      const randomVariation = (Math.random() * 0.008) * close; // 0.8% de variation
      return highestPoint + upperDeviation + randomVariation;
    });
    
    const lower = closes.map((close, i) => {
      const lowestPoint = Math.min(lows[i], close);
      const randomVariation = (Math.random() * 0.006) * close; // 0.6% de variation
      return lowestPoint - lowerDeviation - randomVariation;
    });

    setUpperBand(upper);
    setLowerBand(lower);
  };

  const generateCandle = (id: number, prevClose: number): Candle => {
    const maxMove = prevClose * 0.03;
    const moveAmount = Math.random() * maxMove;
    
    const direction = prevClose > lastPrice ? 
      (Math.random() > 0.8 ? 1 : -1) : 
      (Math.random() > 0.2 ? 1 : -1);  
      
    const close = prevClose + (direction * moveAmount);
    const bodyRange = Math.abs(close - prevClose);
    
    // Distribution des types de mèches:
    // 30% sans mèches
    // 20% une mèche en haut seulement
    // 20% une mèche en bas seulement
    // 30% deux mèches
    const wickType = Math.random();
    
    if (wickType < 0.3) {
      // Pas de mèches
      return {
        id,
        open: prevClose,
        close,
        high: Math.max(prevClose, close),
        low: Math.min(prevClose, close),
        color: close >= prevClose ? '#22c55e' : '#ef4444'
      };
    }
    
    const getWickSize = () => {
      const random = Math.random();
      return bodyRange * (0.1 + (random * random) * 1.2);
    };

    let upperWickSize = 0;
    let lowerWickSize = 0;

    if (wickType < 0.5) {
      // Mèche en haut seulement
      upperWickSize = getWickSize() * (Math.random() > 0.8 ? 2.5 : 1);
    } else if (wickType < 0.7) {
      // Mèche en bas seulement
      lowerWickSize = getWickSize() * (Math.random() > 0.8 ? 2.5 : 1);
    } else {
      // Deux mèches
      upperWickSize = getWickSize();
      lowerWickSize = getWickSize();
      // Chance d'avoir une mèche longue
      if (Math.random() > 0.8) {
        if (Math.random() > 0.5) {
          upperWickSize *= 2.5;
        } else {
          lowerWickSize *= 2.5;
        }
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
        const newCandles = [...prev.slice(1), newCandle];
        calculateBands(newCandles);
        return newCandles;
      });
    }, 444); // 666ms / 1.5 = 444ms pour speed x1.5

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-[400px] bg-black/50 rounded-lg p-4">
      <div className="h-[67%] flex items-end relative">
        {/* Bandes de Bollinger */}
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-[75%] h-full" preserveAspectRatio="none">
            {/* Bande supérieure */}
            <path
              d={upperBand.map((value, index) => {
                const x = (index / (candles.length - 1)) * 100;
                const y = 100 - ((value - Math.min(...lowerBand)) / (Math.max(...upperBand) - Math.min(...lowerBand))) * 100;
                return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="1.5"
            />
            {/* Bande inférieure */}
            <path
              d={lowerBand.map((value, index) => {
                const x = (index / (candles.length - 1)) * 100;
                const y = 100 - ((value - Math.min(...lowerBand)) / (Math.max(...upperBand) - Math.min(...lowerBand))) * 100;
                return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        
        {/* Zone des bougies - maintenant sur les 2/3 gauches */}
        <div className="w-[75%] h-full flex items-end space-x-2">
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
                className="relative w-4 h-full"
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
        
        {/* Zone vide pour le dernier tiers */}
        <div className="w-[25%]"></div>
      </div>
    </div>
  );
}
