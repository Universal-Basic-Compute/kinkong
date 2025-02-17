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
    const padding = 60;

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
      const minRadius = 10; // Reduced from 20
      const maxRadius = 25; // Reduced from 50
      const scale = (liquidity - minLiquidity) / (maxLiquidity - minLiquidity);
      return minRadius + scale * (maxRadius - minRadius);
    };

    // Color gradient based on volume/liquidity ratio
    const getColor = (volume: number, liquidity: number) => {
      const ratio = volume / liquidity;
      const normalized = Math.min(1, Math.max(0, ratio / 2));
      
      // Define gradient colors
      const colors = {
        fill: {
          low: [39, 65, 86],    // Dark blue
          high: [217, 72, 15]   // Bright orange
        },
        stroke: {
          low: [54, 90, 119],   // Lighter blue
          high: [255, 85, 18]   // Brighter orange
        }
      };

      // Interpolate between colors
      const interpolate = (start: number[], end: number[], factor: number) => {
        return start.map((c, i) => Math.round(c + (end[i] - c) * factor));
      };

      const fillColor = interpolate(colors.fill.low, colors.fill.high, normalized);
      const strokeColor = interpolate(colors.stroke.low, colors.stroke.high, normalized);

      return {
        fill: `rgba(${fillColor.join(',')}, 0.3)`,
        stroke: `rgb(${strokeColor.join(',')})`
      };
    };

    // Draw grid lines
    const drawGrid = () => {
      for (let i = 0; i <= 4; i++) {
        const x = padding + (i * (width - 2 * padding) / 4);
        const y = padding + (i * (height - 2 * padding) / 4);
        
        // Vertical lines
        svg.appendChild(createLine(x, padding, x, height - padding));
        // Horizontal lines
        svg.appendChild(createLine(padding, y, width - padding, y));
      }
    };

    const createLine = (x1: number, y1: number, x2: number, y2: number) => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toString());
      line.setAttribute('y1', y1.toString());
      line.setAttribute('x2', x2.toString());
      line.setAttribute('y2', y2.toString());
      line.setAttribute('stroke', 'rgba(255, 215, 0, 0.1)');
      line.setAttribute('stroke-width', '1');
      return line;
    };

    // Create tooltip div
    const tooltip = document.createElement('div');
    tooltip.className = 'fixed hidden bg-black/90 border border-gold/20 rounded-lg p-3 text-sm z-50';
    document.body.appendChild(tooltip);

    // Draw grid
    drawGrid();

    // Draw bubbles
    tokens.forEach(token => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      const x = scaleX(token.volumeGrowth);
      const y = scaleY(token.pricePerformance);
      const radius = scaleRadius(token.liquidity);
      const colors = getColor(token.volume7d, token.liquidity);

      // Create bubble
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x.toString());
      circle.setAttribute('cy', y.toString());
      circle.setAttribute('r', radius.toString());
      circle.setAttribute('fill', colors.fill);
      circle.setAttribute('stroke', colors.stroke);
      circle.setAttribute('stroke-width', '2');

      // Add token text (symbol and name)
      const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      // Symbol text
      const symbolText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      symbolText.setAttribute('x', x.toString());
      symbolText.setAttribute('y', (y - 2).toString()); // Move up slightly
      symbolText.setAttribute('text-anchor', 'middle');
      symbolText.setAttribute('dominant-baseline', 'bottom');
      symbolText.setAttribute('fill', 'white');
      symbolText.setAttribute('font-size', '10');
      symbolText.setAttribute('font-weight', 'bold');
      symbolText.textContent = token.symbol;

      // Name text
      const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      nameText.setAttribute('x', x.toString());
      nameText.setAttribute('y', (y + 2).toString()); // Move down slightly
      nameText.setAttribute('text-anchor', 'middle');
      nameText.setAttribute('dominant-baseline', 'top');
      nameText.setAttribute('fill', 'rgba(255, 255, 255, 0.6)'); // Slightly transparent
      nameText.setAttribute('font-size', '8');
      nameText.textContent = token.name;

      // Add both texts to the group
      textGroup.appendChild(symbolText);
      textGroup.appendChild(nameText);

      // Hover effects
      group.addEventListener('mouseenter', (e) => {
        circle.setAttribute('stroke-width', '3');
        symbolText.setAttribute('fill', colors.stroke); // Highlight text
        nameText.setAttribute('fill', colors.stroke); // Highlight text
        tooltip.innerHTML = `
          <div class="font-bold mb-1">${token.symbol}</div>
          <div class="text-gray-400 text-xs mb-2">${token.name}</div>
          <div>Volume Growth: ${token.volumeGrowth.toFixed(2)}%</div>
          <div>Price Performance: ${token.pricePerformance.toFixed(2)}%</div>
          <div>Liquidity: $${token.liquidity.toLocaleString()}</div>
          <div>7d Volume: $${token.volume7d.toLocaleString()}</div>
        `;
        tooltip.style.display = 'block';
        
        // Get container's position relative to viewport
        const rect = container.getBoundingClientRect();
        const tooltipX = rect.left + x + window.scrollX;
        const tooltipY = rect.top + y + window.scrollY;
        
        tooltip.style.left = `${tooltipX + 20}px`;
        tooltip.style.top = `${tooltipY - 20}px`;
      });

      group.addEventListener('mouseleave', () => {
        circle.setAttribute('stroke-width', '2');
        symbolText.setAttribute('fill', 'white'); // Reset text color
        nameText.setAttribute('fill', 'rgba(255, 255, 255, 0.6)'); // Reset text color
        tooltip.style.display = 'none';
      });

      group.appendChild(circle);
      group.appendChild(textGroup);
      svg.appendChild(group);
    });

    // Add axes and labels
    const xAxis = createLine(padding, height - padding, width - padding, height - padding);
    const yAxis = createLine(padding, padding, padding, height - padding);
    xAxis.setAttribute('stroke', 'rgba(255, 215, 0, 0.5)');
    yAxis.setAttribute('stroke', 'rgba(255, 215, 0, 0.5)');
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

    // Cleanup
    return () => {
      document.body.removeChild(tooltip);
    };
  }, [tokens]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[400px] bg-black/30 rounded-lg border border-gold/20 relative"
    />
  );
}
