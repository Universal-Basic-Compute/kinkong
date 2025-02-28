'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  children, 
  content,
  position = 'top'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  // Position classes based on the position prop
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2'
  };
  
  // Arrow classes based on the position prop
  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gold/90',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gold/90',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gold/90',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gold/90'
  };

  return (
    <div className="relative inline-block">
      <div 
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      
      {isVisible && (
        <div 
          ref={tooltipRef}
          className={`absolute z-50 ${positionClasses[position]} max-w-xs bg-black/90 border border-gold/30 text-white text-sm rounded-lg p-3 shadow-lg transition-opacity duration-200`}
        >
          {content}
          <div 
            className={`absolute w-0 h-0 border-8 border-transparent ${arrowClasses[position]}`}
          ></div>
        </div>
      )}
    </div>
  );
};
