'use client';

import { useState, useEffect } from 'react';

type Advice = {
  text: string;
  source: string;
};

const adviceList: Advice[] = [
  { 
    text: "The best traders are not afraid to take profits. Don't let greed turn a winning trade into a losing one.", 
    source: "Trading Psychology"
  },
  { 
    text: "Always have a clear exit strategy before entering a trade. Know your take profit and stop loss levels.", 
    source: "Risk Management"
  },
  { 
    text: "Market structure matters more than indicators. Learn to read price action and market structure.", 
    source: "Technical Analysis"
  },
  { 
    text: "The trend is your friend. Trading with the trend increases your probability of success.", 
    source: "Trading Fundamentals"
  },
  { 
    text: "Risk only what you can afford to lose. Position sizing is key to long-term survival.", 
    source: "Capital Management"
  },
  { 
    text: "Patience is a virtue in trading. Wait for high-probability setups rather than forcing trades.", 
    source: "Trading Discipline"
  },
  { 
    text: "The market can remain irrational longer than you can remain solvent. Respect market sentiment.", 
    source: "Market Wisdom"
  },
  { 
    text: "Focus on the process, not the outcome. A good process will lead to good results over time.", 
    source: "Trading Mindset"
  },
  { 
    text: "Keep a trading journal. Review your trades regularly to identify patterns and improve.", 
    source: "Continuous Improvement"
  },
  { 
    text: "The first loss is the best loss. Cut losing trades quickly and let winners run.", 
    source: "Trade Management"
  }
];

export default function AnimatedAdvice() {
  const [currentAdvice, setCurrentAdvice] = useState<Advice>(adviceList[0]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      
      setTimeout(() => {
        const randomIndex = Math.floor(Math.random() * adviceList.length);
        setCurrentAdvice(adviceList[randomIndex]);
        setIsVisible(true);
      }, 500); // Wait for fade out before changing text
      
    }, 8000); // Change every 8 seconds
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-black/30 border border-gold/20 rounded-lg">
      <div className={`space-y-2 ${isVisible ? 'animate-fadeIn' : 'opacity-0'}`}>
        <p className="text-gray-300 italic">"{currentAdvice.text}"</p>
        <p className="text-gold text-sm text-right">— {currentAdvice.source}</p>
      </div>
    </div>
  );
}
