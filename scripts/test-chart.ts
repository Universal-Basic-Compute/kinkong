import { generateTokenChart, getChartData } from '../utils/charts';
import fs from 'fs';

interface Candlestick {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

async function testChart() {
    try {
        // UBC mint address
        const ubcMint = 'UFBt9b3jqXfpVB3q6dDYgTPsWjcRGCWuWVNj5hB5pKnS';
        
        console.log('Generating chart for UBC...');
        const chartBuffer = await generateTokenChart(ubcMint);
        
        // Save to file
        fs.writeFileSync('ubc-chart.png', chartBuffer);
        console.log('Chart saved as ubc-chart.png');
        
        // Also log some chart data
        const data = await getChartData(ubcMint);
        console.log('Latest price:', data.candlesticks[data.candlesticks.length - 1].close);
        console.log('24h high:', Math.max(...data.candlesticks.map((c: Candlestick) => c.high)));
        console.log('24h low:', Math.min(...data.candlesticks.map((c: Candlestick) => c.low)));
        console.log('24h volume:', data.candlesticks.reduce((sum: number, c: Candlestick) => sum + c.volume, 0));
        
        // Calculate price change
        const firstPrice = data.candlesticks[0].open;
        const lastPrice = data.candlesticks[data.candlesticks.length - 1].close;
        const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
        console.log('24h price change:', priceChange.toFixed(2) + '%');
        
    } catch (error) {
        console.error('Failed to generate chart:', error);
    }
}

testChart();
