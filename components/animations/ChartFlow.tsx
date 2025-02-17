'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChartFlowProps {
  onComplete?: () => void;
}

export function ChartFlow({ onComplete }: ChartFlowProps) {
  const [currentChart, setCurrentChart] = useState<string | null>(null);
  const [decision, setDecision] = useState<'BUY' | 'SELL' | null>(null);
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(() => {
    // Function to get all chart files from public/charts
    const loadCharts = async () => {
      try {
        // In production, we'll need an API endpoint to get the chart list
        // For now, let's simulate with a few charts
        const chartList = [
          '/charts/sol/SOL_15m_candles_trading_view.png',
          '/charts/ubc/UBC_15m_candles_trading_view.png',
          '/charts/bonk/BONK_15m_candles_trading_view.png',
          // Add more chart paths
        ];
        setQueue(chartList);
      } catch (error) {
        console.error('Error loading charts:', error);
      }
    };

    loadCharts();
  }, []);

  useEffect(() => {
    if (queue.length > 0 && !currentChart) {
      // Show next chart
      setCurrentChart(queue[0]);
      setQueue(prev => prev.slice(1));
      
      // Randomly decide BUY or SELL
      setDecision(Math.random() > 0.5 ? 'BUY' : 'SELL');
      
      // Reset for next chart after animation
      const timer = setTimeout(() => {
        setCurrentChart(null);
        setDecision(null);
      }, 2000); // Adjust timing as needed
      
      return () => clearTimeout(timer);
    }
  }, [queue, currentChart]);

  return (
    <div className="relative w-full h-[600px] overflow-hidden bg-black/50">
      {/* Buy Zone */}
      <motion.div 
        className="absolute right-0 top-1/2 -translate-y-1/2 w-32 h-32 bg-green-500/20 rounded-full flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: decision === 'BUY' ? 1 : 0 }}
      >
        <span className="text-green-400 font-bold text-xl">BUY</span>
      </motion.div>

      {/* Sell Zone */}
      <motion.div 
        className="absolute left-0 top-1/2 -translate-y-1/2 w-32 h-32 bg-red-500/20 rounded-full flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: decision === 'SELL' ? 1 : 0 }}
      >
        <span className="text-red-400 font-bold text-xl">SELL</span>
      </motion.div>

      {/* Chart Animation */}
      <AnimatePresence>
        {currentChart && (
          <motion.div
            className="absolute top-1/2 left-1/2 w-96 h-64 perspective-1000"
            initial={{ 
              scale: 0.1, 
              z: -1000,
              x: '-50%',
              y: '-50%',
              rotateX: 45
            }}
            animate={[
              // First grow from distance
              {
                scale: 1,
                z: 0,
                rotateX: 0,
                transition: { duration: 0.5 }
              },
              // Then move to decision zone
              {
                x: decision === 'BUY' ? '100%' : '-150%',
                opacity: 0,
                transition: { delay: 0.5, duration: 0.5 }
              }
            ]}
            exit={{ opacity: 0 }}
          >
            <img 
              src={currentChart} 
              alt="Trading Chart"
              className="w-full h-full object-cover rounded-lg shadow-lg"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Analysis Overlay */}
      <motion.div
        className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-full"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: currentChart ? 1 : 0, y: 0 }}
      >
        <span className="text-white font-mono">AI Analyzing Patterns...</span>
      </motion.div>

      {/* Technical Indicators */}
      <motion.div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: currentChart ? 1 : 0, y: 0 }}
      >
        {['RSI', 'MACD', 'VOL', 'MA'].map((indicator) => (
          <div 
            key={indicator}
            className="bg-white/10 px-3 py-1 rounded-full"
          >
            <span className="text-sm text-white/80">{indicator}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
