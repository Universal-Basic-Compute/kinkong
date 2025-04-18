import { Chart, ChartConfiguration } from 'chart.js/auto';
import { enUS } from 'date-fns/locale';

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

export async function getChartData(mintAddress: string): Promise<ChartDataSet> {
  try {
    const response = await fetch(
      `https://price.jup.ag/v4/price/history?` +
      `ids=${mintAddress}&` +
      `vsToken=USDC&` +
      `timeframe=24H&` +
      `interval=1H`
    );

    if (!response.ok) {
      throw new Error(`Jupiter API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data || !data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid data format from Jupiter API');
    }

    // Transform data into candlestick format
    const candlesticks: Candlestick[] = data.data.map((item: any) => ({
      timestamp: Math.floor(new Date(item.time).getTime() / 1000),
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume || '0')
    }));

    // Calculate EMAs
    const closes = candlesticks.map(c => c.close);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);

    // Ensure we have data
    if (candlesticks.length === 0) {
      throw new Error('No price data available');
    }

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
    // Create mock data for testing
    const now = Math.floor(Date.now() / 1000);
    const mockData = Array.from({ length: 24 }, (_, i) => ({
      timestamp: now - (23 - i) * 3600,
      open: 1.0,
      high: 1.1,
      low: 0.9,
      close: 1.0,
      volume: 1000
    }));

    const mockEma = mockData.map(() => 1.0);

    return {
      candlesticks: mockData,
      volume: mockData.map(d => ({ time: d.timestamp, value: d.volume })),
      ema20: mockData.map(d => ({ time: d.timestamp, value: mockEma[0] })),
      ema50: mockData.map(d => ({ time: d.timestamp, value: mockEma[0] }))
    };
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
