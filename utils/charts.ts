import { Chart, ChartConfiguration, ChartTypeRegistry } from 'chart.js/auto';
import { createCanvas } from 'canvas';

interface Candlestick {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface ChartDataSet {
    candlesticks: Candlestick[];
    volume: Array<{time: number, value: number}>;
    ema20: Array<{time: number, value: number}>;
    ema50: Array<{time: number, value: number}>;
}

type CandlestickData = {
    x: Date;
    o: number;
    h: number;
    l: number;
    c: number;
};

export async function generateTokenChart(token: string): Promise<Buffer> {
    // Get data
    const data = await getChartData(token);
    
    // Create canvas
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');
    
    // Create chart
    new Chart(ctx as any, config);
        type: 'bar', // We'll use bar as base type and customize it
        data: {
            datasets: [
                // Candlestick dataset
                {
                    type: 'bar',
                    label: token,
                    data: data.candlesticks.map((candle: Candlestick) => ({
                        x: new Date(candle.timestamp * 1000),
                        o: candle.open,
                        h: candle.high,
                        l: candle.low,
                        c: candle.close
                    } as CandlestickData)),
                    backgroundColor: 'rgba(75, 192, 75, 1)',
                },
                // EMA 20 line
                {
                    type: 'line',
                    label: 'EMA 20',
                    data: data.ema20.map(point => ({
                        x: new Date(point.time * 1000),
                        y: point.value
                    })),
                    borderColor: 'rgba(255, 215, 0, 0.8)',
                    borderWidth: 1,
                    pointRadius: 0,
                },
                // EMA 50 line
                {
                    type: 'line',
                    label: 'EMA 50',
                    data: data.ema50.map(point => ({
                        x: new Date(point.time * 1000),
                        y: point.value
                    })),
                    borderColor: 'rgba(75, 192, 192, 0.8)',
                    borderWidth: 1,
                    pointRadius: 0,
                },
                // Volume bars
                {
                    type: 'bar',
                    label: 'Volume',
                    data: data.volume.map(v => ({
                        x: new Date(v.time * 1000),
                        y: v.value
                    })),
                    backgroundColor: 'rgba(128, 128, 128, 0.2)',
                    yAxisID: 'volume'
                }
            ]
        },
        options: {
            responsive: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour'
                    },
                    grid: {
                        color: 'rgba(255, 215, 0, 0.1)'
                    },
                    ticks: {
                        color: '#d1d4dc'
                    }
                },
                y: {
                    position: 'right',
                    grid: {
                        color: 'rgba(255, 215, 0, 0.1)'
                    },
                    ticks: {
                        color: '#d1d4dc'
                    }
                },
                volume: {
                    position: 'left',
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#d1d4dc'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#d1d4dc'
                    }
                }
            },
            backgroundColor: 'black'
        }
    });
    
    // Convert to buffer
    // Convert to buffer and return
    return canvas.toBuffer('image/png');
}

export async function getChartData(mintAddress: string): Promise<ChartDataSet> {
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
        time: c.timestamp,
        value: c.volume
      })),
      ema20: candlesticks.map((c, i) => ({
        time: c.timestamp,
        value: ema20[i]
      })),
      ema50: candlesticks.map((c, i) => ({
        time: c.timestamp,
        value: ema50[i]
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
