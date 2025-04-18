'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SignalDisplay {
  token: string;
  type: 'BUY' | 'SELL';
}

interface StreamingReason {
  text: string;
  fullText: string;
  index: number;
  isComplete: boolean;
}

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
  const [secondaryCandles, setSecondaryCandles] = useState<Candle[]>([]);
  const [secondaryLastPrice, setSecondaryLastPrice] = useState(100);
  const [tertiaryCandles, setTertiaryCandles] = useState<Candle[]>([]);
  const [tertiaryLastPrice, setTertiaryLastPrice] = useState(100);
  const [displaySignals, setDisplaySignals] = useState<SignalDisplay[]>([]);
  const [currentSignalIndex, setCurrentSignalIndex] = useState(0);
  const [streamingReasons, setStreamingReasons] = useState<StreamingReason[]>([
    { text: '', fullText: '', index: 0, isComplete: false },
    { text: '', fullText: '', index: 0, isComplete: false },
    { text: '', fullText: '', index: 0, isComplete: false }
  ]);

  const generateSignal = (candleId: number) => ({
    id: Math.random(),
    type: Math.random() > 0.5 ? 'BUY' : 'SELL',
    candleId
  });

  const generateCandle = (id: number, prevClose: number, volatilityMultiplier: number = 1): Candle => {
    // Augmenter l'amplitude des mouvements en fonction du multiplicateur
    const maxMove = prevClose * 0.06 * volatilityMultiplier;
    const moveAmount = Math.random() * maxMove;
    
    // Simple random direction
    const direction = Math.random() > 0.5 ? 1 : -1;
      
    const close = prevClose + (direction * moveAmount);
    const bodyRange = Math.abs(close - prevClose);
    
    // Augmenter la taille des mèches pour plus de volatilité
    const getWickSize = () => {
      const random = Math.random();
      return bodyRange * (0.2 + (random * random) * 1.8) * volatilityMultiplier;
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
    const initialCandles: Candle[] = [];
    let currentPrice = lastPrice;
    
    const initialSecondaryCandles: Candle[] = [];
    let secondaryPrice = 100 * (1 + (Math.random() * 0.4 - 0.2));
    
    const initialTertiaryCandles: Candle[] = [];
    let tertiaryPrice = 100 * (1 + (Math.random() * 0.4 - 0.2));
    
    for (let i = 0; i < 60; i++) {
      const candle = generateCandle(i, currentPrice, 1); // volatilité normale
      initialCandles.push(candle);
      currentPrice = candle.close;
      
      const secondaryCandle = generateCandle(i, secondaryPrice, 1.5); // 50% plus volatile
      initialSecondaryCandles.push(secondaryCandle);
      secondaryPrice = secondaryCandle.close;
      
      const tertiaryCandle = generateCandle(i, tertiaryPrice, 2); // 100% plus volatile
      initialTertiaryCandles.push(tertiaryCandle);
      tertiaryPrice = tertiaryCandle.close;
    }

    setCandles(initialCandles);
    setLastPrice(currentPrice);
    
    setSecondaryCandles(initialSecondaryCandles);
    setSecondaryLastPrice(secondaryPrice);
    
    setTertiaryCandles(initialTertiaryCandles);
    setTertiaryLastPrice(tertiaryPrice);

    const interval = setInterval(() => {
      setCandles(prev => {
        const newCandle = generateCandle(prev[prev.length - 1].id + 1, prev[prev.length - 1].close, 1);
        return [...prev.slice(1), newCandle];
      });
      
      setSecondaryCandles(prev => {
        const newCandle = generateCandle(prev[prev.length - 1].id + 1, prev[prev.length - 1].close, 1.5);
        return [...prev.slice(1), newCandle];
      });
      
      setTertiaryCandles(prev => {
        const newCandle = generateCandle(prev[prev.length - 1].id + 1, prev[prev.length - 1].close, 2);
        return [...prev.slice(1), newCandle];
      });
    }, 444);

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

  const getRandomReasons = async () => {
    try {
      const response = await fetch('/api/signals');
      if (!response.ok) throw new Error('Failed to fetch signals');
      const data = await response.json();
      
      // Mélanger le tableau et prendre 3 raisons
      const shuffled = [...data].sort(() => 0.5 - Math.random());
      const reasons = shuffled.slice(0, 3).map(signal => signal.reason);
      
      return reasons;
    } catch (error) {
      console.error('Error fetching reasons:', error);
      return [
        'Analyzing market patterns...',
        'Detecting price movements...',
        'Calculating momentum indicators...'
      ];
    }
  };

  useEffect(() => {
    let timeouts: NodeJS.Timeout[] = [];
    let isActive = true; // Pour gérer le nettoyage
    
    const updateStreams = async () => {
      if (!isActive) return; // Vérifier si le composant est toujours monté

      const reasons = await getRandomReasons();
      
      // Réinitialiser les textes
      setStreamingReasons(reasons.map(reason => ({
        text: '',
        fullText: reason,
        index: 0,
        isComplete: false
      })));

      // Créer un effet de streaming pour chaque raison avec des délais différents
      reasons.forEach((_, streamIndex) => {
        const initialDelay = streamIndex * 1000;

        timeouts.push(setTimeout(() => {
          const streamText = () => {
            if (!isActive) return;
            
            setStreamingReasons(prev => prev.map((stream, index) => {
              if (index !== streamIndex) return stream;
              if (stream.isComplete) return stream;
              
              const newIndex = stream.index + 1;
              const isComplete = newIndex >= stream.fullText.length;
              
              return {
                ...stream,
                text: stream.fullText.substring(0, newIndex),
                index: newIndex,
                isComplete
              };
            }));
          };

          // Créer un timeout pour chaque caractère
          for (let i = 0; i < reasons[streamIndex].length; i++) {
            timeouts.push(setTimeout(streamText, i * 50));
          }
        }, initialDelay));
      });

      // Attendre que tous les textes soient complets avant de redémarrer
      const totalDuration = Math.max(...reasons.map(r => r.length)) * 50 + 3000; // Durée max + 3s de pause
      timeouts.push(setTimeout(() => {
        if (isActive) {
          updateStreams(); // Relancer le cycle
        }
      }, totalDuration));
    };

    updateStreams();

    return () => {
      isActive = false;
      timeouts.forEach(clearTimeout);
    };
  }, []);


  return (
    <div className="w-full">
      <div className="h-[400px] bg-black/50 rounded-lg p-4">
        <div className="h-[67%] flex items-end relative">
          {/* Zone des bougies - réduire à 75% */}
          <div className="w-[75%] h-full flex items-end space-x-1 relative">
          {/* Graphe tertiaire en arrière-plan */}
          <div className="absolute inset-0 flex items-end space-x-1 opacity-30">
            <AnimatePresence>
              {tertiaryCandles.map((candle) => {
                const highest = Math.max(...tertiaryCandles.map(c => c.high));
                const lowest = Math.min(...tertiaryCandles.map(c => c.low));
                const priceRange = highest - lowest;

                const highPercent = ((candle.high - lowest) / priceRange) * 100;
                const lowPercent = ((candle.low - lowest) / priceRange) * 100;
                const openPercent = ((candle.open - lowest) / priceRange) * 100;
                const closePercent = ((candle.close - lowest) / priceRange) * 100;

                const bodyHeight = Math.abs(closePercent - openPercent);
                const bodyBottom = Math.min(closePercent, openPercent);
                
                const wickHeight = highPercent - lowPercent;
                const wickBottom = lowPercent;

                return (
                  <motion.div
                    key={`tertiary-${candle.id}`}
                    className="relative w-4 h-full"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 0.3, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div 
                      className="absolute w-[1px] left-1/2 -translate-x-1/2"
                      style={{
                        backgroundColor: candle.color,
                        height: `${wickHeight}%`,
                        bottom: `${wickBottom}%`
                      }}
                    />
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
          {/* Graphe secondaire au milieu */}
          <div className="absolute inset-0 flex items-end space-x-1 opacity-60">
            <AnimatePresence>
              {secondaryCandles.map((candle) => {
                const highest = Math.max(...secondaryCandles.map(c => c.high));
                const lowest = Math.min(...secondaryCandles.map(c => c.low));
                const priceRange = highest - lowest;

                const highPercent = ((candle.high - lowest) / priceRange) * 100;
                const lowPercent = ((candle.low - lowest) / priceRange) * 100;
                const openPercent = ((candle.open - lowest) / priceRange) * 100;
                const closePercent = ((candle.close - lowest) / priceRange) * 100;

                const bodyHeight = Math.abs(closePercent - openPercent);
                const bodyBottom = Math.min(closePercent, openPercent);
                
                const wickHeight = highPercent - lowPercent;
                const wickBottom = lowPercent;

                return (
                  <motion.div
                    key={`secondary-${candle.id}`}
                    className="relative w-4 h-full"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 0.6, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div 
                      className="absolute w-[1px] left-1/2 -translate-x-1/2"
                      style={{
                        backgroundColor: candle.color,
                        height: `${wickHeight}%`,
                        bottom: `${wickBottom}%`
                      }}
                    />
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
                <div className={`px-3 py-1 rounded ${
                  signal.type === 'BUY' 
                    ? 'bg-green-500/10 metallic-green' 
                    : 'bg-red-500/10 metallic-red'
                } text-sm font-medium`}>
                  {signal.type}
                </div>
                <div className="metallic-gold text-sm ml-2">
                  ${signal.token}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      </div>
      
        {/* Section des raisons en streaming - texte simple */}
        <div className="absolute bottom-[180px] left-0 w-[75%] flex justify-center gap-16">
          {streamingReasons.map((stream, index) => (
            <div 
              key={index}
              className="max-w-[280px] absolute"
              style={{
                transform: `translateX(${(index - 1) * 300}px)` // Décale chaque texte horizontalement
              }}
            >
              <p className="text-xs font-mono leading-relaxed text-amber-50/90">
                {stream.text}
                {stream.isComplete && (
                  <span className="animate-pulse ml-1 opacity-70">🦍</span>
                )}
              </p>
            </div>
          ))}
        </div>
    </div>
  );
}
