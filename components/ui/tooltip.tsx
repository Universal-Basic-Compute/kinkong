'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      let top = 0;
      let left = 0;
      
      switch (position) {
        case 'top':
          top = triggerRect.top - tooltipRect.height - 8;
          left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'right':
          top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
          left = triggerRect.right + 8;
          break;
        case 'bottom':
          top = triggerRect.bottom + 8;
          left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'left':
          top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
          left = triggerRect.left - tooltipRect.width - 8;
          break;
      }
      
      // Adjust for scroll position
      top += window.scrollY;
      left += window.scrollX;
      
      setTooltipPosition({ top, left });
    }
  }, [isVisible, position]);

  // Arrow classes based on the position prop
  const arrowClasses = {
    top: 'bottom-[-8px] left-1/2 -translate-x-1/2 border-t-gold/90 border-r-transparent border-b-transparent border-l-transparent',
    right: 'left-[-8px] top-1/2 -translate-y-1/2 border-t-transparent border-r-gold/90 border-b-transparent border-l-transparent',
    bottom: 'top-[-8px] left-1/2 -translate-x-1/2 border-t-transparent border-r-transparent border-b-gold/90 border-l-transparent',
    left: 'right-[-8px] top-1/2 -translate-y-1/2 border-t-transparent border-r-transparent border-b-transparent border-l-gold/90'
  };

  return (
    <>
      <div 
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="inline-block"
      >
        {children}
      </div>
      
      {mounted && isVisible && createPortal(
        <div 
          ref={tooltipRef}
          className="fixed z-[9999] max-w-xs bg-black/90 border border-gold/30 text-white text-sm rounded-lg p-3 shadow-lg transition-opacity duration-200"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`
          }}
        >
          {content}
          <div 
            className={`absolute w-0 h-0 border-8 ${arrowClasses[position]}`}
          ></div>
        </div>,
        document.body
      )}
    </>
  );
};
