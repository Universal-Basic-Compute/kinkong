import { TokenMetricsCollector, MetricsResponse } from '@/backend/src/utils/metrics_collector';

interface TokenMetrics {
  token: string;
  price: {
    current: number;
    high24h: number;
    low24h: number;
    change24h: number;
    updateTime: string;
  };
  volume: {
    amount24h: number;
    change: number;
    changePercent: number;
    largeTransactions: number;
  };
  trades: {
    count24h: number;
    avgSize: number;
    uniqueTraders: number;
    newTraders: number;
  };
  market: {
    depthBid: number;
    depthAsk: number;
    buySellRatio: number;
    liquidity: number;
  };
  analysis: {
    volatility24h: number;
    momentum24h: number;
    trendStrength: number;
    averageSlippage: number;
  };
}

export async function getTokenMetrics(token: string): Promise<TokenMetrics> {
  const collector = new TokenMetricsCollector(process.env.BIRDEYE_API_KEY || '');
  const metrics = await collector.get_token_metrics(token);

  if (!metrics.success) {
    throw new Error(metrics.error || 'Failed to fetch token metrics');
  }

  return {
    token,
    price: {
      current: metrics.price_metrics.current,
      high24h: metrics.trade_metrics.price.high24h,
      low24h: metrics.trade_metrics.price.low24h,
      change24h: metrics.trade_metrics.price.change24h,
      updateTime: metrics.price_metrics.updateTime
    },
    volume: {
      amount24h: metrics.trade_metrics.volume.amount24h,
      change: metrics.trade_metrics.volume.change,
      changePercent: metrics.trade_metrics.volume.changePercent,
      largeTransactions: metrics.trade_metrics.volume.largeTransactions
    },
    trades: {
      count24h: metrics.trade_metrics.trades.count24h,
      avgSize: metrics.trade_metrics.trades.avgSize,
      uniqueTraders: metrics.trader_metrics.uniqueTraders,
      newTraders: metrics.trader_metrics.newTraders
    },
    market: {
      depthBid: metrics.trade_metrics.market.depthBid,
      depthAsk: metrics.trade_metrics.market.depthAsk,
      buySellRatio: metrics.trade_metrics.market.buySellRatio,
      liquidity: metrics.trade_metrics.market.liquidity
    },
    analysis: {
      volatility24h: metrics.trade_metrics.analysis.volatility24h,
      momentum24h: metrics.trade_metrics.analysis.momentum24h,
      trendStrength: metrics.trade_metrics.analysis.trendStrength,
      averageSlippage: metrics.trade_metrics.analysis.averageSlippage
    }
  };
}
