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
      absolute -top-2 -right-16 
      bg-gold text-black 
      px-4 py-2 
      rounded-lg 
      shadow-lg
      transform transition-all duration-300
      ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
      before:content-[''] 
      before:absolute 
      before:left-0 
      before:top-1/2 
      before:-translate-x-1/2
      before:-translate-y-1/2
      before:border-8 
      before:border-transparent 
      before:border-r-gold
    `}>
      <span className="font-medium">{message}</span>
    </div>
  );
}
