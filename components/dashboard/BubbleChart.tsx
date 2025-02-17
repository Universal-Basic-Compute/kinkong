'use client';

import { useRef, useState } from 'react';
import Draggable from 'react-draggable';
import type { DraggableData, DraggableEvent } from 'react-draggable';

interface TokenInfo {
  symbol: string;
  name: string;
  mint: string;
  volume7d: number;
  liquidity: number;
  volumeGrowth: number;
  pricePerformance: number;
  marketCap: number;
}

interface BubblePosition {
  x: number;
  y: number;
}

function calculateBubbleSize(marketCap: number): number {
  const baseSize = 60;
  const scale = Math.log10(marketCap + 1) / Math.log10(1e9);
  return baseSize + (scale * 60);
}

function getTokenClass(token: string): string {
  if (!token) return 'metallic-text-argent';
  
  const upperToken = token.toUpperCase();
  switch (upperToken) {
    case 'UBC':
      return 'metallic-text-ubc';
    case 'COMPUTE':
      return 'metallic-text-compute';
    case 'SOL':
      return 'metallic-text-sol';
    default:
      return 'metallic-text-argent';
  }
}

interface BubbleChartProps {
  tokens: TokenInfo[];
}

export function BubbleChart({ tokens }: BubbleChartProps) {
  const [bubblePositions, setBubblePositions] = useState<Record<string, BubblePosition>>({});

  const handleDrag = (mint: string, e: DraggableEvent, data: DraggableData) => {
    setBubblePositions(prev => ({
      ...prev,
      [mint]: { x: data.x, y: data.y }
    }));
  };

  return (
    <div className="mb-12 relative h-[400px] bg-black/30 rounded-lg border border-gold/20 p-4">
      <div className="absolute inset-0">
        {tokens.map((token) => {
          const nodeRef = useRef(null);
          const position = bubblePositions[token.mint] || {
            x: Math.random() * 500,
            y: Math.random() * 300
          };

          return (
            <Draggable
              key={token.mint}
              nodeRef={nodeRef}
              position={position}
              onDrag={(e, data) => handleDrag(token.mint, e, data)}
              bounds="parent"
            >
              <div ref={nodeRef} className="relative group cursor-move">
                <div 
                  className={`
                    rounded-full flex items-center justify-center
                    transition-all duration-300
                    ${token.pricePerformance >= 0 ? 'bg-green-900/20' : 'bg-red-900/20'}
                    hover:z-10
                  `}
                  style={{
                    width: `${calculateBubbleSize(token.marketCap)}px`,
                    height: `${calculateBubbleSize(token.marketCap)}px`,
                    boxShadow: `0 0 20px ${token.pricePerformance >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  }}
                >
                  <div className="text-center">
                    <div className={`text-lg font-bold ${getTokenClass(token.symbol)}`}>
                      ${token.symbol}
                    </div>
                    <div className={`text-sm ${token.pricePerformance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {token.pricePerformance.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                  <div className="bg-black/90 border border-gold/20 rounded-lg p-3 whitespace-nowrap text-sm">
                    <div className="font-bold mb-1">${token.symbol}</div>
                    <div className="text-gray-300">Market Cap: ${(token.marketCap || 0).toLocaleString()}</div>
                    <div className="text-gray-300">Volume: ${token.volume7d.toLocaleString()}</div>
                    <div className="text-gray-300">Liquidity: ${token.liquidity.toLocaleString()}</div>
                    <div className={token.volumeGrowth >= 0 ? 'text-green-400' : 'text-red-400'}>
                      Volume Growth: {token.volumeGrowth.toFixed(1)}%
                    </div>
                    <div className={token.pricePerformance >= 0 ? 'text-green-400' : 'text-red-400'}>
                      Price Change: {token.pricePerformance.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </Draggable>
          );
        })}
      </div>
    </div>
  );
}
