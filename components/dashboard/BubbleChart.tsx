'use client';

import { useRef, useEffect } from 'react';

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

interface BubbleChartProps {
  tokens: TokenInfo[];
}

export function BubbleChart({ tokens }: BubbleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = 400;
    const padding = 40;

    // Clear previous content
    container.innerHTML = '';

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    container.appendChild(svg);

    // Calculate scales
    const maxMarketCap = Math.max(...tokens.map(t => t.marketCap));
    const minMarketCap = Math.min(...tokens.map(t => t.marketCap));
    
    const maxVolume = Math.max(...tokens.map(t => t.volume7d));
    const minVolume = Math.min(...tokens.map(t => t.volume7d));

    // Scale functions
    const scaleX = (volume: number) => {
      return padding + ((volume - minVolume) / (maxVolume - minVolume)) * (width - 2 * padding);
    };

    const scaleY = (marketCap: number) => {
      return height - (padding + ((marketCap - minMarketCap) / (maxMarketCap - minMarketCap)) * (height - 2 * padding));
    };

    const scaleRadius = (marketCap: number) => {
      const minRadius = 20;
      const maxRadius = 60;
      const scale = (marketCap - minMarketCap) / (maxMarketCap - minMarketCap);
      return minRadius + scale * (maxRadius - minRadius);
    };

    // Draw bubbles
    tokens.forEach(token => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      // Create bubble
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      const x = scaleX(token.volume7d);
      const y = scaleY(token.marketCap);
      const radius = scaleRadius(token.marketCap);

      circle.setAttribute('cx', x.toString());
      circle.setAttribute('cy', y.toString());
      circle.setAttribute('r', radius.toString());
      circle.setAttribute('fill', token.pricePerformance >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)');
      circle.setAttribute('stroke', token.pricePerformance >= 0 ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)');
      circle.setAttribute('stroke-width', '2');

      // Add token symbol text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x.toString());
      text.setAttribute('y', y.toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', 'white');
      text.setAttribute('font-size', '14');
      text.textContent = token.symbol;

      // Add hover effects and tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'absolute hidden bg-black/90 border border-gold/20 rounded-lg p-3 text-sm z-50';
      container.appendChild(tooltip);

      group.addEventListener('mouseenter', (e) => {
        circle.setAttribute('stroke-width', '3');
        tooltip.innerHTML = `
          <div class="font-bold mb-1">${token.symbol}</div>
          <div>Market Cap: $${token.marketCap.toLocaleString()}</div>
          <div>Volume: $${token.volume7d.toLocaleString()}</div>
          <div>Performance: ${token.pricePerformance.toFixed(2)}%</div>
        `;
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.pageX + 10}px`;
        tooltip.style.top = `${e.pageY + 10}px`;
      });

      group.addEventListener('mousemove', (e) => {
        tooltip.style.left = `${e.pageX + 10}px`;
        tooltip.style.top = `${e.pageY + 10}px`;
      });

      group.addEventListener('mouseleave', () => {
        circle.setAttribute('stroke-width', '2');
        tooltip.style.display = 'none';
      });

      group.appendChild(circle);
      group.appendChild(text);
      svg.appendChild(group);
    });

    // Add axes
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', padding.toString());
    xAxis.setAttribute('y1', (height - padding).toString());
    xAxis.setAttribute('x2', (width - padding).toString());
    xAxis.setAttribute('y2', (height - padding).toString());
    xAxis.setAttribute('stroke', 'rgba(255, 215, 0, 0.3)');
    xAxis.setAttribute('stroke-width', '1');

    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', padding.toString());
    yAxis.setAttribute('y1', padding.toString());
    yAxis.setAttribute('x2', padding.toString());
    yAxis.setAttribute('y2', (height - padding).toString());
    yAxis.setAttribute('stroke', 'rgba(255, 215, 0, 0.3)');
    yAxis.setAttribute('stroke-width', '1');

    svg.appendChild(xAxis);
    svg.appendChild(yAxis);

    // Add axis labels
    const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xLabel.setAttribute('x', (width / 2).toString());
    xLabel.setAttribute('y', (height - 10).toString());
    xLabel.setAttribute('text-anchor', 'middle');
    xLabel.setAttribute('fill', 'rgba(255, 215, 0, 0.5)');
    xLabel.textContent = 'Volume';

    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yLabel.setAttribute('x', '20');
    yLabel.setAttribute('y', (height / 2).toString());
    yLabel.setAttribute('text-anchor', 'middle');
    yLabel.setAttribute('transform', `rotate(-90, 20, ${height / 2})`);
    yLabel.setAttribute('fill', 'rgba(255, 215, 0, 0.5)');
    yLabel.textContent = 'Market Cap';

    svg.appendChild(xLabel);
    svg.appendChild(yLabel);

  }, [tokens]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[400px] bg-black/30 rounded-lg border border-gold/20 relative"
    />
  );
}
