'use client';

import { useRef, useEffect } from 'react';

import { TokenInfo } from '@/types/token';

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

    // Filter out stablecoins first
    const nonStableTokens = tokens.filter(token => 
      token.token !== 'USDT' && token.token !== 'USDC'
    );

    // Then apply validation filters
    const validTokens = nonStableTokens.filter(token => {
      return (
        typeof token.volumeGrowth === 'number' && 
        typeof token.priceTrend === 'number' &&
        typeof token.liquidity === 'number' &&
        !isNaN(token.volumeGrowth) &&
        !isNaN(token.priceTrend) &&
        !isNaN(token.liquidity)
      );
    });

    // Add outlier detection before calculating scales
    const detectAndHandleOutliers = (data: number[], factor: number = 1.5) => {
      if (data.length < 4) return { min: Math.min(...data), max: Math.max(...data) };
      
      // Sort the data
      const sorted = [...data].sort((a, b) => a - b);
      
      // Calculate quartiles
      const q1Index = Math.floor(sorted.length / 4);
      const q3Index = Math.floor(sorted.length * 3 / 4);
      const q1 = sorted[q1Index];
      const q3 = sorted[q3Index];
      
      // Calculate IQR (Interquartile Range)
      const iqr = q3 - q1;
      
      // Define bounds for outliers
      const lowerBound = q1 - factor * iqr;
      const upperBound = q3 + factor * iqr;
      
      // Filter out outliers for min/max calculation
      const filteredData = sorted.filter(value => value >= lowerBound && value <= upperBound);
      
      return {
        min: filteredData.length > 0 ? Math.min(...filteredData) : Math.min(...data),
        max: filteredData.length > 0 ? Math.max(...filteredData) : Math.max(...data)
      };
    };

    // Use outlier detection for scale calculations
    const volumeGrowthBounds = detectAndHandleOutliers(validTokens.map(t => t.volumeGrowth || 0));
    const priceTrendBounds = detectAndHandleOutliers(validTokens.map(t => t.priceTrend || 0));
    const liquidityBounds = detectAndHandleOutliers(validTokens.map(t => t.liquidity || 0), 2); // Use higher factor for liquidity

    const minVolumeGrowth = volumeGrowthBounds.min;
    const maxVolumeGrowth = volumeGrowthBounds.max;
    const minPriceTrend = priceTrendBounds.min;
    const maxPriceTrend = priceTrendBounds.max;
    const minLiquidity = liquidityBounds.min;
    const maxLiquidity = liquidityBounds.max;

    // Scale functions with validation
    const scaleX = (volumeGrowth: number) => {
      if (isNaN(volumeGrowth) || maxVolumeGrowth === minVolumeGrowth) return padding;
      
      // Cap extreme values to prevent squishing
      const cappedValue = Math.min(Math.max(volumeGrowth, minVolumeGrowth * 1.5), maxVolumeGrowth * 0.8);
      
      return padding + ((cappedValue - minVolumeGrowth) / (maxVolumeGrowth - minVolumeGrowth)) * (width - 2 * padding);
    };

    const scaleY = (priceTrend: number) => {
      if (isNaN(priceTrend) || maxPriceTrend === minPriceTrend) return height - padding;
      
      // Cap extreme values to prevent squishing
      const cappedValue = Math.min(Math.max(priceTrend, minPriceTrend * 1.5), maxPriceTrend * 0.8);
      
      return height - (padding + ((cappedValue - minPriceTrend) / (maxPriceTrend - minPriceTrend)) * (height - 2 * padding));
    };

    const scaleRadius = (liquidity: number) => {
      if (isNaN(liquidity) || maxLiquidity === minLiquidity) return 10;
      
      const minRadius = 10;
      const maxRadius = 25;
      
      // Use logarithmic scale for radius calculation
      // Add 1 to avoid log(0) and to ensure small values get a reasonable size
      const logMin = Math.log(minLiquidity + 1);
      const logMax = Math.log(maxLiquidity + 1);
      const logValue = Math.log(liquidity + 1);
      
      // Calculate normalized position in log scale
      const logScale = (logValue - logMin) / (logMax - logMin);
      
      // Apply the scale to the radius range
      return minRadius + logScale * (maxRadius - minRadius);
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

    // Draw bubbles using validated data
    validTokens.forEach(token => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      const x = scaleX(token.volumeGrowth);
      const y = scaleY(token.priceTrend);
      const radius = scaleRadius(token.liquidity);
      const colors = getColor(token.volume24h || 0, token.liquidity);

      // Create bubble
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x.toString());
      circle.setAttribute('cy', y.toString());
      circle.setAttribute('r', radius.toString());
      circle.setAttribute('fill', colors.fill);
      circle.setAttribute('stroke', colors.stroke);
      circle.setAttribute('stroke-width', '2');

      // Add token text (token and name)
      const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      // token text
      const tokenText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tokenText.setAttribute('x', x.toString());
      tokenText.setAttribute('y', (y - 2).toString()); // Move up slightly
      tokenText.setAttribute('text-anchor', 'middle');
      tokenText.setAttribute('dominant-baseline', 'bottom');
      tokenText.setAttribute('fill', 'white');
      tokenText.setAttribute('font-size', '10');
      tokenText.setAttribute('font-weight', 'bold');
      tokenText.textContent = token.token;

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
      textGroup.appendChild(tokenText);
      textGroup.appendChild(nameText);

      // Hover effects
      group.addEventListener('mouseenter', (e) => {
        circle.setAttribute('stroke-width', '3');
        tokenText.setAttribute('fill', colors.stroke); // Highlight text
        nameText.setAttribute('fill', colors.stroke); // Highlight text
        tooltip.innerHTML = `
          <div class="font-bold mb-1">${token.token}</div>
          <div class="text-gray-400 text-xs mb-2">${token.name}</div>
          <div>Volume Growth: ${(token.volumeGrowth || 0).toFixed(2)}%</div>
          <div>Price Trend: ${(token.priceTrend || 0).toFixed(2)}%</div>
          <div>Volume 24h: $${(token.volume24h || 0).toLocaleString()}</div>
          <div>Liquidity: $${(token.liquidity || 0).toLocaleString()}</div>
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
        tokenText.setAttribute('fill', 'white'); // Reset text color
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
    yLabel.textContent = 'Price Trend (%)';

    svg.appendChild(xLabel);
    svg.appendChild(yLabel);

    // Cleanup
    return () => {
      // Safely remove tooltip if it exists
      if (tooltip && document.body.contains(tooltip)) {
        document.body.removeChild(tooltip);
      }
    };
  }, [tokens]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[400px] bg-black/30 rounded-lg border border-gold/20 relative"
    />
  );
}
