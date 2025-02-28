'use client';

import { useState, useEffect } from 'react';

const messages = [
  "Need trading insights?",
  "Ask me anything!",
  "I analyze markets 24/7",
  "Let's find alpha together",
  "What's your trading strategy?",
  "Looking for signals?",
  "How can I help today?"
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
