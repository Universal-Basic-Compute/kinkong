import { createCanvas } from 'canvas';
import { 
    createChart, 
    ColorType,
    Time,
    CandlestickData,
    LineData,
    HistogramData,
    CandlestickSeriesOptions,
    LineSeriesOptions,
    HistogramSeriesOptions,
    SeriesType
} from 'lightweight-charts';

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
    volume: Array<{time: number, value: number}>;
    ema20: Array<{time: number, value: number}>;
    ema50: Array<{time: number, value: number}>;
}

export async function generateTokenChart(token: string): Promise<Buffer> {
    const width = 800;
    const height = 400;
    
    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Create chart
    const chart = createChart(canvas as any, {
        width: width,
        height: height,
        layout: {
            background: { type: ColorType.Solid, color: '#000000' },
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: 'rgba(255, 215, 0, 0.1)' },
            horzLines: { color: 'rgba(255, 215, 0, 0.1)' },
        },
    });
    
    // Get historical data
    const data = await getChartData(token);
    
    // Add candlestick series
    const candlestickSeries = chart.addSeries<SeriesType.Candlestick>({
        priceFormat: { type: 'price' },
        upColor: 'rgba(75, 192, 75, 1)',
        downColor: 'rgba(192, 75, 75, 1)',
        wickUpColor: 'rgba(75, 192, 75, 1)',
        wickDownColor: 'rgba(192, 75, 75, 1)',
    } as CandlestickSeriesOptions);
    
    // Format data for lightweight-charts
    const candleData: CandlestickData[] = data.candlesticks.map(candle => ({
        time: new Date(candle.timestamp * 1000).toISOString().split('T')[0] as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
    }));
    
    candlestickSeries.setData(candleData);
    
    // Add EMA lines
    const ema20Series = chart.addSeries<SeriesType.Line>({
        priceFormat: { type: 'price' },
        color: 'rgba(255, 215, 0, 0.8)',
        lineWidth: 1,
        lineType: 0,
    } as LineSeriesOptions);
    
    const ema50Series = chart.addSeries<SeriesType.Line>({
        priceFormat: { type: 'price' },
        color: 'rgba(75, 192, 192, 0.8)',
        lineWidth: 1,
        lineType: 0,
    } as LineSeriesOptions);
    
    const ema20Data: LineData[] = data.ema20.map(point => ({
        time: new Date(point.time * 1000).toISOString().split('T')[0] as Time,
        value: point.value,
    }));
    
    const ema50Data: LineData[] = data.ema50.map(point => ({
        time: new Date(point.time * 1000).toISOString().split('T')[0] as Time,
        value: point.value,
    }));
    
    ema20Series.setData(ema20Data);
    ema50Series.setData(ema50Data);
    
    // Add volume
    const volumeSeries = chart.addSeries<SeriesType.Histogram>({
        priceFormat: { type: 'volume' },
        color: 'rgba(128, 128, 128, 0.2)',
        priceScaleId: '',
    } as HistogramSeriesOptions);
    
    const volumeData: HistogramData[] = data.volume.map(v => ({
        time: new Date(v.time * 1000).toISOString().split('T')[0] as Time,
        value: v.value,
    }));
    
    volumeSeries.setData(volumeData);
    
    // Fit content
    chart.timeScale().fitContent();
    
    // Convert to buffer
    const buffer = canvas.toBuffer('image/png');
    return buffer;
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
