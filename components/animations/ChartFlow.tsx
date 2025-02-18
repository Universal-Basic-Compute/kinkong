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

interface Signal {
  id: number;
  type: 'BUY' | 'SELL';
  candleId: number;
}

export function ChartFlow() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [lastPrice, setLastPrice] = useState(100);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [activeSignal, setActiveSignal] = useState<'BUY' | 'SELL' | null>(null);

  const generateSignal = (candleId: number) => ({
    id: Math.random(),
    type: Math.random() > 0.5 ? 'BUY' : 'SELL',
    candleId
  });

  const generateCandle = (id: number, prevClose: number): Candle => {
    const maxMove = prevClose * (activeSignal ? 0.06 : 0.03);
    const moveAmount = Math.random() * maxMove;
    
    const direction = activeSignal === 'BUY' ? 
      (Math.random() > 0.3 ? 1 : -1) :  // 70% de chance de monter après BUY
      activeSignal === 'SELL' ? 
      (Math.random() > 0.7 ? 1 : -1) :  // 30% de chance de monter après SELL
      prevClose > lastPrice ? 
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
    
    for (let i = 0; i < 60; i++) {
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
        return newCandles;
      });
    }, 444); // 666ms / 1.5 = 444ms pour speed x1.5

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const generateRandomSignal = () => {
      if (candles.length > 0) {
        const type = Math.random() > 0.5 ? 'BUY' : 'SELL';
        setSignals([{
          id: Math.random(),
          type,
          candleId: candles[candles.length - 1].id
        }]);
        
        // Mettre à jour le signal actif
        setActiveSignal(type);
        
        // Réinitialiser le signal après 2.5-3.5 secondes
        setTimeout(() => {
          setActiveSignal(null);
        }, Math.random() * 1000 + 2500);

        // Intervalle beaucoup plus long entre les signaux : 20-40 secondes
        const nextDelay = Math.random() * 20000 + 20000;
        timeoutId = setTimeout(generateRandomSignal, nextDelay);
      }
    };

    // Ne démarrer que si nous avons des bougies
    if (candles.length > 0) {
      generateRandomSignal();
    }

    // Cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [candles]); // Ajouter la dépendance aux candles

  return (
    <div className="w-full h-[400px] bg-black/50 rounded-lg p-4">
      <div className="h-[67%] flex items-end relative">
        {/* Zone des bougies - réduire à 75% */}
        <div className="w-[75%] h-full flex items-end space-x-1">
          <AnimatePresence>
            {candles.map((candle) => {
            // Calculer les hauteurs relatives
            const highest = Math.max(...candles.map(c => c.high));
            const lowest = Math.min(...candles.map(c => c.low));
            const priceRange = highest - lowest;

            // Calculer les positions relatives en pourcentage (retour à 100% pour la hauteur)
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

          {/* Signaux animés */}
          <AnimatePresence>
            {signals.map((signal) => (
              <motion.div
                key={signal.id}
                className={`absolute ${
                  signal.type === 'BUY' ? 'text-green-500' : 'text-red-500'
                } font-bold text-xl`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                style={{
                  bottom: '100%',
                  right: '25%',
                  transform: 'translateX(50%)'
                }}
              >
                {signal.type}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {/* Zone vide augmentée à 25% */}
        <div className="w-[25%]"></div>
      </div>
    </div>
  );
}
