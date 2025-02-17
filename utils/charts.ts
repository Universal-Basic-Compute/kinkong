import { createCanvas } from 'canvas';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration, ChartOptions } from 'chart.js';

interface Candlestick {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface ChartData {
    candlesticks: Candlestick[];
    volume: Array<{x: number, y: number}>;
    ema20: Array<{x: number, y: number}>;
    ema50: Array<{x: number, y: number}>;
}

export async function generateTokenChart(token: string): Promise<Buffer> {
  const width = 800;
  const height = 400;
  
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
  
  // Get historical data
  const data = await getChartData(token);
  
  // Configure chart
  const configuration: ChartConfiguration = {
    type: 'bar', // We'll use bar as base type and customize for candlesticks
    data: {
      datasets: [{
        label: token,
        data: data.candlesticks.map((c: Candlestick) => ({
          x: c.timestamp,
          o: c.open,
          h: c.high,
          l: c.low,
          c: c.close
        })) as any[],
        type: 'candlestick' as any, // Custom type
        color: {
          up: 'rgba(75, 192, 75, 1)',
          down: 'rgba(192, 75, 75, 1)',
          unchanged: 'rgba(75, 75, 192, 1)',
        }
      }, {
        label: 'Volume',
        data: data.volume,
        type: 'bar',
        backgroundColor: 'rgba(128, 128, 128, 0.2)',
        yAxisID: 'volume'
      }, {
        label: 'EMA20',
        data: data.ema20,
        type: 'line',
        borderColor: 'rgba(255, 215, 0, 0.8)',
        borderWidth: 1,
        fill: false
      }, {
        label: 'EMA50',
        data: data.ema50,
        type: 'line',
        borderColor: 'rgba(75, 192, 192, 0.8)',
        borderWidth: 1,
        fill: false
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'hour'
          },
          grid: {
            color: 'rgba(255, 215, 0, 0.1)'
          }
        },
        y: {
          type: 'linear',
          position: 'left',
          grid: {
            color: 'rgba(255, 215, 0, 0.1)'
          }
        },
        volume: {
          type: 'linear',
          position: 'right',
          grid: {
            display: false
          }
        } as ChartOptions
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      }
    }
  };
  
  // Generate chart image
  const image = await chartJSNodeCanvas.renderToBuffer(configuration);
  return image;
}

export async function getChartData(mintAddress: string): Promise<ChartData> {
  try {
    // Get Jupiter API data for last 24 hours
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (24 * 60 * 60); // 24 hours ago
    
    const response = await fetch(
      `https://price.jup.ag/v4/price/history?` +
      `id=${mintAddress}&` +
      `startTime=${startTime}&` +
      `endTime=${endTime}&` +
      `interval=1H`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch price history');
    }

    const data = await response.json();
    
    // Transform data into candlestick format
    const candlesticks: Candlestick[] = data.data.map((item: any) => ({
      timestamp: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume
    }));

    // Calculate EMAs
    const ema20 = calculateEMA(candlesticks.map((c: Candlestick) => c.close), 20);
    const ema50 = calculateEMA(candlesticks.map((c: Candlestick) => c.close), 50);

    return {
      candlesticks,
      volume: candlesticks.map(c => ({
        x: c.timestamp,
        y: c.volume
      })),
      ema20: candlesticks.map((c: Candlestick, i: number) => ({
        x: c.timestamp,
        y: ema20[i]
      })),
      ema50: candlesticks.map((c: Candlestick, i: number) => ({
        x: c.timestamp,
        y: ema50[i]
      }))
    };
  } catch (error) {
    console.error('Failed to fetch chart data:', error);
    throw error;
  }
}

function calculateEMA(prices: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const ema = [prices[0]]; // First EMA is same as first price

  for (let i = 1; i < prices.length; i++) {
    ema[i] = (prices[i] - ema[i-1]) * multiplier + ema[i-1];
  }

  return ema;
}
