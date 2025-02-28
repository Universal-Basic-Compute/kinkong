'use client';

import { useState, useEffect } from 'react';

const messages = [
  "SOL showing bullish divergence on 4H chart",
  "JUP volume spiking, potential breakout soon",
  "Social sentiment for BONK turning positive",
  "Portfolio rebalance needed: Increase AI tokens",
  "PYTH forming cup and handle, watch $0.42 level",
  "Whale accumulation detected in JTO",
  "Liquidity building at $25 for SOL, strong support",
  "Twitter alpha: New Solana NFT marketplace launching",
  "Consider taking profits on RNDR, RSI overbought",
  "On-chain data shows BOME accumulation by insiders",
  "Momentum shifting to DeFi tokens this week",
  "Set stop loss for BONK at recent swing low",
  "Telegram sentiment analysis: Bullish on JUP",
  "Consider hedging SOL position with PUT options",
  "Resistance cluster at $30 for SOL, prepare for volatility"
];

export default function AnimatedChatBubble() {
  const [message, setMessage] = useState(messages[0]);
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      
      setTimeout(() => {
        const randomIndex = Math.floor(Math.random() * messages.length);
        setMessage(messages[randomIndex]);
        setIsVisible(true);
      }, 300); // Wait for fade out before changing text
      
    }, 5000); // Change every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`
      absolute -top-25 left-1/2 -translate-x-1/2
      bg-gold text-black 
      px-5 py-3 
      rounded-lg 
      shadow-lg
      transform transition-all duration-300
      ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
      after:content-[''] 
      after:absolute 
      after:left-1/2 
      after:-translate-x-1/2
      after:top-[95%]
      after:border-8 
      after:border-transparent 
      after:border-t-gold
      min-w-[240px]
      text-center
      z-10
      text-base
    `}>
      <span className="font-medium">{message}</span>
    </div>
  );
}
