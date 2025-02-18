'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SignalDisplay {
  token: string;
  type: 'BUY' | 'SELL';
}

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
  const [displaySignals, setDisplaySignals] = useState<SignalDisplay[]>([]);
  const [currentSignalIndex, setCurrentSignalIndex] = useState(0);

  const generateSignal = (candleId: number) => ({
    id: Math.random(),
    type: Math.random() > 0.5 ? 'BUY' : 'SELL',
    candleId
  });

  const generateCandle = (id: number, prevClose: number): Candle => {
    // Augmenter l'amplitude des mouvements
    const maxMove = prevClose * (activeSignal ? 0.12 : 0.06); // Doublé les pourcentages (6% -> 12% avec signal, 3% -> 6% sans)
    const moveAmount = Math.random() * maxMove;
    
    // Créer des tendances plus prononcées
    const direction = activeSignal === 'BUY' ? 
      (Math.random() > 0.2 ? 1 : -1) :  // 80% de chance de monter après BUY
      activeSignal === 'SELL' ? 
      (Math.random() > 0.8 ? 1 : -1) :  // 20% de chance de monter après SELL
      prevClose > lastPrice ? 
      (Math.random() > 0.7 ? 1 : -1) :  // Plus de continuité dans la tendance
      (Math.random() > 0.3 ? 1 : -1);   // Plus de continuité dans la tendance
      
    const close = prevClose + (direction * moveAmount);
    const bodyRange = Math.abs(close - prevClose);
    
    // Augmenter la taille des mèches pour plus de volatilité
    const getWickSize = () => {
      const random = Math.random();
      return bodyRange * (0.2 + (random * random) * 1.8); // Augmenté la taille des mèches
    };

    // Distribution des types de mèches plus extrêmes:
    const wickType = Math.random();
    
    if (wickType < 0.2) { // Réduit la probabilité de bougies sans mèches
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
    
    let upperWickSize = 0;
    let lowerWickSize = 0;

    if (wickType < 0.4) {
      // Mèche en haut seulement
      upperWickSize = getWickSize() * (Math.random() > 0.6 ? 3 : 1); // Plus de chances de grandes mèches
    } else if (wickType < 0.6) {
      // Mèche en bas seulement
      lowerWickSize = getWickSize() * (Math.random() > 0.6 ? 3 : 1);
    } else {
      // Deux mèches
      upperWickSize = getWickSize();
      lowerWickSize = getWickSize();
      // Plus de chances d'avoir des mèches longues
      if (Math.random() > 0.6) {
        if (Math.random() > 0.5) {
          upperWickSize *= 3;
        } else {
          lowerWickSize *= 3;
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
    const fetchSignals = async () => {
      try {
        const response = await fetch('/api/signals');
        if (!response.ok) throw new Error('Failed to fetch signals');
        const data = await response.json();
        
        const validSignals = data.map((signal: any) => ({
          token: signal.token,
          type: signal.type
        }));
        
        setDisplaySignals(validSignals);
      } catch (error) {
        console.error('Error fetching signals:', error);
      }
    };

    fetchSignals();
  }, []);

  useEffect(() => {
    if (displaySignals.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentSignalIndex((prev) => 
        prev + 1 >= displaySignals.length ? 0 : prev + 1
      );
    }, 2000); // Change every 2 seconds

    return () => clearInterval(interval);
  }, [displaySignals]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const generateRandomSignal = () => {
      if (candles.length === 0) return; // Skip if no candles
      
      console.log('Generating signal at:', new Date().toISOString());
      const type = Math.random() > 0.5 ? 'BUY' : 'SELL';
      setSignals([{
        id: Math.random(),
        type,
        candleId: candles[candles.length - 1].id
      }]);
      
      setActiveSignal(type);
      
      setTimeout(() => {
        setActiveSignal(null);
      }, Math.random() * 1000 + 2500);

      // Changé pour 3-5 secondes (3000-5000ms)
      const nextDelay = Math.random() * 2000 + 3000;
      console.log('Next signal scheduled in', nextDelay/1000, 'seconds');
      timeoutId = setTimeout(generateRandomSignal, nextDelay);
    };

    console.log('Signal effect starting');
    generateRandomSignal();

    return () => {
      console.log('Cleaning up signal effect');
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []); // Remove candles dependency

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
        
        {/* Signal display zone - 25% */}
        <div className="w-[25%] h-full flex flex-col justify-start pl-4">
          <div className="bg-black/30 rounded-lg p-2">
            {displaySignals.slice(currentSignalIndex, currentSignalIndex + 3).map((signal, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="flex justify-between items-center py-2 border-b border-gold/10 last:border-0"
              >
                <span className="metallic-text-gold font-normal text-sm">${signal.token}</span>
                <span className={`px-2 py-1 rounded ${
                  signal.type === 'BUY' 
                    ? 'bg-green-900/50 metallic-text-green' 
                    : 'bg-red-900/50 metallic-text-red'
                } text-sm font-medium`}>
                  {signal.type}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
