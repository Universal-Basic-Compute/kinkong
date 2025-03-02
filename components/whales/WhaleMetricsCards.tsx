import { useMemo } from 'react';

interface WhaleMetricsCardsProps {
  data: any[];
  isLoading: boolean;
}

export function WhaleMetricsCards({ data, isLoading }: WhaleMetricsCardsProps) {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalWhales: 0,
        bullishPercentage: 0,
        bearishPercentage: 0,
        neutralPercentage: 0,
        avgConfidence: 0,
        highActivityPercentage: 0
      };
    }
    
    const totalWhales = data.length;
    const bullish = data.filter(item => item.outlook === 'BULLISH').length;
    const bearish = data.filter(item => item.outlook === 'BEARISH').length;
    const neutral = data.filter(item => item.outlook === 'NEUTRAL').length;
    
    const bullishPercentage = (bullish / totalWhales) * 100;
    const bearishPercentage = (bearish / totalWhales) * 100;
    const neutralPercentage = (neutral / totalWhales) * 100;
    
    const confidenceSum = data.reduce((sum, item) => sum + (Number(item.confidenceScore) || 0), 0);
    const avgConfidence = confidenceSum / totalWhales;
    
    const highActivity = data.filter(item => item.tradingActivity === 'HIGH').length;
    const highActivityPercentage = (highActivity / totalWhales) * 100;
    
    return {
      totalWhales,
      bullishPercentage,
      bearishPercentage,
      neutralPercentage,
      avgConfidence,
      highActivityPercentage
    };
  }, [data]);
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-black/30 p-6 rounded-lg border border-gold/20 animate-pulse h-32">
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
        <h3 className="text-sm text-gray-400 mb-1">Total Whales Analyzed</h3>
        <p className="text-3xl font-bold">{metrics.totalWhales}</p>
      </div>
      
      <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
        <h3 className="text-sm text-gray-400 mb-1">Bullish Sentiment</h3>
        <p className="text-3xl font-bold text-green-500">{metrics.bullishPercentage.toFixed(1)}%</p>
      </div>
      
      <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
        <h3 className="text-sm text-gray-400 mb-1">Bearish Sentiment</h3>
        <p className="text-3xl font-bold text-red-500">{metrics.bearishPercentage.toFixed(1)}%</p>
      </div>
      
      <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
        <h3 className="text-sm text-gray-400 mb-1">Neutral Sentiment</h3>
        <p className="text-3xl font-bold text-blue-500">{metrics.neutralPercentage.toFixed(1)}%</p>
      </div>
      
      <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
        <h3 className="text-sm text-gray-400 mb-1">Average Confidence</h3>
        <p className="text-3xl font-bold">{metrics.avgConfidence.toFixed(1)}</p>
      </div>
      
      <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
        <h3 className="text-sm text-gray-400 mb-1">High Trading Activity</h3>
        <p className="text-3xl font-bold">{metrics.highActivityPercentage.toFixed(1)}%</p>
      </div>
    </div>
  );
}
