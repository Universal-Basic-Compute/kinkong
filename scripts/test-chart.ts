import { getChartData } from '../utils/charts';

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
        // Correct UBC mint address
        const ubcMint = '9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump';
        
        console.log('Getting chart data for UBC...');
        const data = await getChartData(ubcMint);
        
        // Log chart data
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
        console.error('Failed to get chart data:', error);
    }
}

testChart();
