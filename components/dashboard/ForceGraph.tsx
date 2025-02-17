'use client';

import { useEffect, useRef } from 'react';
import ForceGraph2D from 'force-graph';

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

interface ForceGraphProps {
  tokens: TokenInfo[];
}

export function ForceGraph({ tokens }: ForceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Transform tokens data into nodes and links
    const nodes = tokens.map(token => ({
      id: token.mint,
      name: token.symbol,
      val: Math.log(token.marketCap || 1), // Node size based on market cap
      color: token.pricePerformance >= 0 ? '#22c55e' : '#ef4444',
      token // Store full token info for tooltip
    }));

    // Create links between tokens based on correlation
    const links = [];
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        // Calculate correlation based on volume growth or other metrics
        const correlation = Math.abs(
          tokens[i].volumeGrowth - tokens[j].volumeGrowth
        ) / 100;
        
        if (correlation > 0.5) { // Only create links for correlated tokens
          links.push({
            source: tokens[i].mint,
            target: tokens[j].mint,
            value: correlation
          });
        }
      }
    }

    const Graph = ForceGraph2D()
      .graphData({ nodes, links })
      .backgroundColor('#000000')
      .nodeLabel(node => `
        ${node.name}
        Market Cap: $${node.token.marketCap.toLocaleString()}
        Volume: $${node.token.volume7d.toLocaleString()}
        Performance: ${node.token.pricePerformance.toFixed(2)}%
      `)
      .nodeRelSize(6)
      .nodeVal('val')
      .nodeColor('color')
      .linkWidth(link => link.value * 2)
      .linkColor(() => 'rgba(255, 215, 0, 0.2)')
      .d3Force('charge', null)
      .d3Force('link')
      .distance(100)
      .d3Force('center', null)
      .width(containerRef.current.clientWidth)
      .height(400);

    // Add graph to container
    containerRef.current.innerHTML = '';
    Graph(containerRef.current);

    // Cleanup
    return () => {
      Graph._destructor();
    };
  }, [tokens]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[400px] bg-black/30 rounded-lg border border-gold/20"
    />
  );
}
