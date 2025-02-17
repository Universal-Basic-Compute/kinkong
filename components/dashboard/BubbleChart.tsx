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
    const padding = 60; // Increased padding for labels

    // Clear previous content
    container.innerHTML = '';

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    container.appendChild(svg);

    // Calculate scales
    const maxVolumeGrowth = Math.max(...tokens.map(t => t.volumeGrowth));
    const minVolumeGrowth = Math.min(...tokens.map(t => t.volumeGrowth));
    const maxPerformance = Math.max(...tokens.map(t => t.pricePerformance));
    const minPerformance = Math.min(...tokens.map(t => t.pricePerformance));
    const maxLiquidity = Math.max(...tokens.map(t => t.liquidity));
    const minLiquidity = Math.min(...tokens.map(t => t.liquidity));

    // Scale functions
    const scaleX = (volumeGrowth: number) => {
      return padding + ((volumeGrowth - minVolumeGrowth) / (maxVolumeGrowth - minVolumeGrowth)) * (width - 2 * padding);
    };

    const scaleY = (performance: number) => {
      return height - (padding + ((performance - minPerformance) / (maxPerformance - minPerformance)) * (height - 2 * padding));
    };

    const scaleRadius = (liquidity: number) => {
      const minRadius = 20;
      const maxRadius = 50;
      const scale = (liquidity - minLiquidity) / (maxLiquidity - minLiquidity);
      return minRadius + scale * (maxRadius - minRadius);
    };

    // Calculate volume/liquidity ratio for color intensity
    const getColor = (volume: number, liquidity: number) => {
      const ratio = volume / liquidity;
      const intensity = Math.min(0.8, Math.max(0.2, ratio / 2)); // Normalize between 0.2 and 0.8
      return {
        fill: `rgba(255, 215, 0, ${intensity * 0.3})`,
        stroke: `rgba(255, 215, 0, ${intensity})`
      };
    };

    // Draw grid lines
    const drawGrid = () => {
      // Vertical grid lines
      for (let i = 0; i <= 4; i++) {
        const x = padding + (i * (width - 2 * padding) / 4);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x.toString());
        line.setAttribute('y1', padding.toString());
        line.setAttribute('x2', x.toString());
        line.setAttribute('y2', (height - padding).toString());
        line.setAttribute('stroke', 'rgba(255, 215, 0, 0.1)');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
      }

      // Horizontal grid lines
      for (let i = 0; i <= 4; i++) {
        const y = padding + (i * (height - 2 * padding) / 4);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', padding.toString());
        line.setAttribute('y1', y.toString());
        line.setAttribute('x2', (width - padding).toString());
        line.setAttribute('y2', y.toString());
        line.setAttribute('stroke', 'rgba(255, 215, 0, 0.1)');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
      }
    };

    // Draw grid
    drawGrid();

    // Draw bubbles
    tokens.forEach(token => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      // Create bubble
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      const x = scaleX(token.volumeGrowth);
      const y = scaleY(token.pricePerformance);
      const radius = scaleRadius(token.liquidity);
      const colors = getColor(token.volume7d, token.liquidity);

      circle.setAttribute('cx', x.toString());
      circle.setAttribute('cy', y.toString());
      circle.setAttribute('r', radius.toString());
      circle.setAttribute('fill', colors.fill);
      circle.setAttribute('stroke', colors.stroke);
      circle.setAttribute('stroke-width', '2');

      // Add token symbol text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x.toString());
      text.setAttribute('y', y.toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', 'white');
      text.setAttribute('font-size', '12');
      text.textContent = token.symbol;

      // Add hover effects and tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'absolute hidden bg-black/90 border border-gold/20 rounded-lg p-3 text-sm z-50';
      container.appendChild(tooltip);

      group.addEventListener('mouseenter', (e) => {
        circle.setAttribute('stroke-width', '3');
        tooltip.innerHTML = `
          <div class="font-bold mb-1">${token.symbol}</div>
          <div>Volume Growth: ${token.volumeGrowth.toFixed(2)}%</div>
          <div>Price Performance: ${token.pricePerformance.toFixed(2)}%</div>
          <div>Liquidity: $${token.liquidity.toLocaleString()}</div>
          <div>7d Volume: $${token.volume7d.toLocaleString()}</div>
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
    xAxis.setAttribute('stroke', 'rgba(255, 215, 0, 0.5)');
    xAxis.setAttribute('stroke-width', '1');

    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', padding.toString());
    yAxis.setAttribute('y1', padding.toString());
    yAxis.setAttribute('x2', padding.toString());
    yAxis.setAttribute('y2', (height - padding).toString());
    yAxis.setAttribute('stroke', 'rgba(255, 215, 0, 0.5)');
    yAxis.setAttribute('stroke-width', '1');

    svg.appendChild(xAxis);
    svg.appendChild(yAxis);

    // Add axis labels
    const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xLabel.setAttribute('x', (width / 2).toString());
    xLabel.setAttribute('y', (height - 10).toString());
    xLabel.setAttribute('text-anchor', 'middle');
    xLabel.setAttribute('fill', 'rgba(255, 215, 0, 0.8)');
    xLabel.textContent = 'Volume Growth (%)';

    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yLabel.setAttribute('x', '20');
    yLabel.setAttribute('y', (height / 2).toString());
    yLabel.setAttribute('text-anchor', 'middle');
    yLabel.setAttribute('transform', `rotate(-90, 20, ${height / 2})`);
    yLabel.setAttribute('fill', 'rgba(255, 215, 0, 0.8)');
    yLabel.textContent = 'Price Performance (%)';

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
