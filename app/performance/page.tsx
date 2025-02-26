'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import fs from 'fs';
import path from 'path';

// Add this after the imports
const perspectiveStyles = `
  .card-3d {
    transform-style: preserve-3d;
    transition: all 0.5s ease;
    perspective: 1000px;
    position: relative;
  }
  
  .card-3d:hover {
    transform: rotateY(10deg) rotateX(5deg);
    box-shadow: -10px 10px 20px rgba(218, 165, 32, 0.2);
    z-index: 10;
  }
  
  .card-3d-image {
    transition: all 0.3s ease;
    transform-style: preserve-3d;
  }
  
  .card-3d:hover .card-3d-image {
    transform: translateZ(20px) scale(1.05);
  }
`;

// Trade chart carousel component
const TradeChartCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [charts, setCharts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCharts() {
      try {
        const response = await fetch('/api/charts/trades');
        if (!response.ok) throw new Error('Failed to fetch charts');
        const data = await response.json();
        setCharts(data.charts.slice(0, 20)); // Get only the 20 most recent
      } catch (error) {
        console.error('Error fetching charts:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCharts();
  }, []);

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === charts.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? charts.length - 1 : prevIndex - 1
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (charts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No trade charts available
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-lg aspect-video relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src={`/charts/trades/${charts[currentIndex]}`}
            alt={`Trade chart ${currentIndex + 1}`}
            fill
            className="object-contain"
          />
        </div>
      </div>
      
      <div className="absolute inset-y-0 left-0 flex items-center">
        <button 
          onClick={prevSlide}
          className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full ml-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button 
          onClick={nextSlide}
          className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full mr-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      <div className="absolute bottom-4 left-0 right-0">
        <div className="flex justify-center gap-2">
          {charts.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 w-2 rounded-full ${
                index === currentIndex ? 'bg-gold' : 'bg-gray-400/50'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Reusable tooltip component
const InfoTooltip = ({ text }: { text: string }) => (
  <div className="group relative inline-block ml-1">
    <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
      i
    </div>
    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10">
      {text}
    </div>
  </div>
);

interface PerformanceMetrics {
  id: string;
  createdAt: string;
  metrics: {
    total_signals: number;
    signals_with_results: number;
    success_rate: number;
    average_actual_return: number;
    average_expected_return: number;
    median_actual_return: number;
    win_rate: number;
    win_loss_ratio: number;
    profit_factor: number;
    sharpe_ratio: number;
    max_drawdown: number;
    recovery_factor: number;
    average_win: number;
    average_loss: number;
    max_consecutive_wins: number;
    max_consecutive_losses: number;
    positive_return_percentage: number;
    buy_signals: number;
    sell_signals: number;
    buy_percentage: number;
    sell_percentage: number;
    high_confidence: number;
    medium_confidence: number;
    low_confidence: number;
    high_confidence_percentage: number;
    medium_confidence_percentage: number;
    low_confidence_percentage: number;
    high_confidence_return: number;
    medium_confidence_return: number;
    low_confidence_return: number;
    high_confidence_success_rate: number;
    medium_confidence_success_rate: number;
    scalp_signals: number;
    intraday_signals: number;
    swing_signals: number;
    position_signals: number;
    scalp_percentage: number;
    intraday_percentage: number;
    swing_percentage: number;
    position_percentage: number;
    scalp_return: number;
    intraday_return: number;
    swing_return: number;
    position_return: number;
    scalp_success_rate: number;
    intraday_success_rate: number;
    swing_success_rate: number;
    position_success_rate: number;
    buy_return: number;
    sell_return: number;
    top_tokens?: Record<string, {
      return: number;
      count: number;
      success_rate: number;
    }>;
    weekly_performance?: Record<string, number>;
  };
}

export default function Performance() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const response = await fetch('/api/signals/performance');
        if (!response.ok) {
          throw new Error('Failed to fetch performance metrics');
        }
        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
        console.error('Error fetching metrics:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Add this style tag */}
      <style jsx global>{perspectiveStyles}</style>
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gold mb-2">Performance & Analytics</h1>
          <p className="text-gray-400">Detailed trading performance metrics and history</p>
        </div>

        {/* Key Metrics */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gold mb-4">Signal Performance Metrics</h2>
          
          {isLoading ? (
            <div className="bg-black/30 p-8 rounded-lg border border-gold/20">
              <div className="flex flex-col items-center justify-center text-center">
                <p className="text-xl text-gold mb-2">Loading metrics...</p>
                <p className="text-gray-400">Please wait while we fetch the latest performance data</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-black/30 p-8 rounded-lg border border-gold/20">
              <div className="flex flex-col items-center justify-center text-center">
                <p className="text-xl text-red-400 mb-2">Error Loading Metrics</p>
                <p className="text-gray-400">{error}</p>
              </div>
            </div>
          ) : !metrics ? (
            <div className="bg-black/30 p-8 rounded-lg border border-gold/20">
              <div className="flex flex-col items-center justify-center text-center">
                <p className="text-xl text-gold mb-2">No Metrics Available</p>
                <p className="text-gray-400">Performance metrics have not been calculated yet</p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-black/30 p-6 rounded-lg border border-gold/20 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gold">Summary Statistics</h3>
                  <span className="text-sm text-gray-400">
                    Last updated: {formatDate(metrics.createdAt)}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Key Metric Cards */}
                  <div className="bg-black/50 p-4 rounded-lg border border-gold/10">
                    <div className="text-gray-400 text-sm mb-1 flex items-center">
                      Total Signals
                      <InfoTooltip text="The total number of BUY signals analyzed in this period. A higher number provides more statistical significance to the metrics." />
                    </div>
                    <div className="text-2xl font-bold text-white">{metrics.metrics.total_signals}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      With results: {metrics.metrics.signals_with_results || 0}
                    </div>
                  </div>
                  
                  <div className="bg-black/50 p-4 rounded-lg border border-gold/10">
                    <div className="text-gray-400 text-sm mb-1 flex items-center">
                      Success Rate
                      <InfoTooltip text="Percentage of signals that resulted in positive returns. Higher rates indicate more accurate predictions and better trading performance." />
                    </div>
                    <div className="text-2xl font-bold text-green-400">
                      {metrics.metrics.success_rate?.toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center">
                      Win/Loss Ratio: {metrics.metrics.win_loss_ratio?.toFixed(2)}
                      <InfoTooltip text="Average win amount divided by average loss amount. Values above 1.0 indicate that winning trades are larger than losing trades." />
                    </div>
                  </div>
                  
                  <div className="bg-black/50 p-4 rounded-lg border border-gold/10">
                    <div className="text-gray-400 text-sm mb-1 flex items-center">
                      Average Return
                      <InfoTooltip text="The mean percentage return across all signals. This shows the typical profit or loss per trade." />
                    </div>
                    <div className={`text-2xl font-bold ${metrics.metrics.average_actual_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {metrics.metrics.average_actual_return?.toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center">
                      Median: {metrics.metrics.median_actual_return?.toFixed(2)}%
                      <InfoTooltip text="The middle value of all returns. Less affected by outliers than the average, providing a more typical result." />
                    </div>
                  </div>
                  
                  <div className="bg-black/50 p-4 rounded-lg border border-gold/10">
                    <div className="text-gray-400 text-sm mb-1 flex items-center">
                      Profit Factor
                      <InfoTooltip text="Total profit divided by total loss. Values above 1.0 indicate overall profitability, with higher values showing stronger performance." />
                    </div>
                    <div className="text-2xl font-bold text-gold">
                      {metrics.metrics.profit_factor?.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center">
                      Sharpe Ratio: {metrics.metrics.sharpe_ratio?.toFixed(2)}
                      <InfoTooltip text="Risk-adjusted return metric. Higher values indicate better returns relative to risk taken. Values above 1.0 are good, above 2.0 are excellent." />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Advanced Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
                  <h3 className="text-xl font-semibold text-gold mb-4 flex items-center">
                    Risk Metrics
                    <InfoTooltip text="Metrics that measure the risk and consistency of trading performance." />
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/50 p-3 rounded-lg border border-gold/10">
                        <div className="text-gray-400 text-xs mb-1 flex items-center">
                          Max Drawdown
                          <InfoTooltip text="The largest percentage drop from peak to trough in cumulative returns. Lower values indicate better risk management." />
                        </div>
                        <div className="text-xl font-bold text-red-400">
                          {metrics.metrics.max_drawdown?.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-black/50 p-3 rounded-lg border border-gold/10">
                        <div className="text-gray-400 text-xs mb-1 flex items-center">
                          Recovery Factor
                          <InfoTooltip text="Average return divided by maximum drawdown. Higher values indicate better ability to recover from losses." />
                        </div>
                        <div className="text-xl font-bold text-green-400">
                          {metrics.metrics.recovery_factor?.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-black/50 p-3 rounded-lg border border-gold/10">
                        <div className="text-gray-400 text-xs mb-1 flex items-center">
                          Average Win
                          <InfoTooltip text="The mean percentage return of all profitable signals. Higher values indicate more effective profit-taking." />
                        </div>
                        <div className="text-xl font-bold text-green-400">
                          {metrics.metrics.average_win?.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-black/50 p-3 rounded-lg border border-gold/10">
                        <div className="text-gray-400 text-xs mb-1 flex items-center">
                          Average Loss
                          <InfoTooltip text="The mean percentage loss of all unprofitable signals. Lower absolute values indicate better stop-loss discipline." />
                        </div>
                        <div className="text-xl font-bold text-red-400">
                          {metrics.metrics.average_loss?.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-black/50 p-3 rounded-lg border border-gold/10">
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-gray-400 text-xs flex items-center">
                          Consistency
                          <InfoTooltip text="Metrics that show how reliable and consistent the trading performance is over time." />
                        </div>
                        <div className="text-xs text-gray-300 flex items-center">
                          {metrics.metrics.positive_return_percentage?.toFixed(1)}% positive returns
                          <InfoTooltip text="Percentage of signals that resulted in any positive return. A measure of overall directional accuracy." />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-xs text-gray-400 flex items-center">
                            Max Consecutive Wins
                            <InfoTooltip text="Longest streak of profitable signals. Indicates potential for sustained positive performance." />
                          </div>
                          <div className="text-lg font-bold text-green-400">
                            {metrics.metrics.max_consecutive_wins || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 flex items-center">
                            Max Consecutive Losses
                            <InfoTooltip text="Longest streak of unprofitable signals. Helps assess worst-case drawdown scenarios." />
                          </div>
                          <div className="text-lg font-bold text-red-400">
                            {metrics.metrics.max_consecutive_losses || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Top Tokens */}
                <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
                  <h3 className="text-xl font-semibold text-gold mb-4 flex items-center">
                    Top Performing Tokens
                    <InfoTooltip text="Tokens with the highest average returns across multiple signals (minimum 3 signals)." />
                  </h3>
                  {metrics.metrics.top_tokens && Object.keys(metrics.metrics.top_tokens).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(metrics.metrics.top_tokens)
                        .sort(([, a], [, b]) => b.return - a.return)
                        .slice(0, 5)
                        .map(([token, data]) => (
                          <div key={token} className="bg-black/50 p-3 rounded-lg border border-gold/10">
                            <div className="flex justify-between items-center">
                              <div className="font-medium text-gold">${token}</div>
                              <div className={`text-sm font-bold ${data.return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {data.return.toFixed(2)}%
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                              <div>Success Rate: {data.success_rate.toFixed(1)}%</div>
                              <div>{data.count} signals</div>
                            </div>
                            <div className="mt-2 h-1 bg-black/50 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gold" 
                                style={{ width: `${Math.min(100, data.success_rate)}%` }}
                              ></div>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-400">
                      No token performance data available
                    </div>
                  )}
                </div>
              </div>
              
              {/* Confidence Level Performance */}
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-6">
                {/* Timeframe Performance */}
                <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
                  <h3 className="text-xl font-semibold text-gold mb-4 flex items-center">
                    Timeframe Performance
                    <InfoTooltip text="Analysis of signal performance based on the intended trading timeframe." />
                  </h3>
                  <div className="space-y-4">
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-blue-900/50 text-blue-400 flex items-center">
                            SCALP
                            <InfoTooltip text="Very short-term trades, typically minutes to hours. Focus on quick price movements and technical patterns." />
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-semibold inline-block ${metrics.metrics.scalp_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {metrics.metrics.scalp_return?.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-black/50">
                        <div style={{ width: `${Math.max(0, Math.min(100, metrics.metrics.scalp_return))}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <div>{metrics.metrics.scalp_signals} signals ({metrics.metrics.scalp_percentage?.toFixed(1)}%)</div>
                        <div>Success Rate: {metrics.metrics.scalp_success_rate?.toFixed(1)}%</div>
                      </div>
                    </div>
                    
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-purple-900/50 text-purple-400 flex items-center">
                            INTRADAY
                            <InfoTooltip text="Trades intended to be opened and closed within the same day. Based on short-term price movements and volatility." />
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-semibold inline-block ${metrics.metrics.intraday_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {metrics.metrics.intraday_return?.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-black/50">
                        <div style={{ width: `${Math.max(0, Math.min(100, metrics.metrics.intraday_return))}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-purple-500"></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <div>{metrics.metrics.intraday_signals} signals ({metrics.metrics.intraday_percentage?.toFixed(1)}%)</div>
                        <div>Success Rate: {metrics.metrics.intraday_success_rate?.toFixed(1)}%</div>
                      </div>
                    </div>
                    
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-teal-900/50 text-teal-400 flex items-center">
                            SWING
                            <InfoTooltip text="Medium-term trades lasting days to weeks. Based on broader market trends and momentum shifts." />
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-semibold inline-block ${metrics.metrics.swing_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {metrics.metrics.swing_return?.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-black/50">
                        <div style={{ width: `${Math.max(0, Math.min(100, metrics.metrics.swing_return))}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-teal-500"></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <div>{metrics.metrics.swing_signals} signals ({metrics.metrics.swing_percentage?.toFixed(1)}%)</div>
                        <div>Success Rate: {metrics.metrics.swing_success_rate?.toFixed(1)}%</div>
                      </div>
                    </div>
                    
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-indigo-900/50 text-indigo-400 flex items-center">
                            POSITION
                            <InfoTooltip text="Long-term trades lasting weeks to months. Based on fundamental analysis and major market trends." />
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-semibold inline-block ${metrics.metrics.position_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {metrics.metrics.position_return?.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-black/50">
                        <div style={{ width: `${Math.max(0, Math.min(100, metrics.metrics.position_return))}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500"></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <div>{metrics.metrics.position_signals} signals ({metrics.metrics.position_percentage?.toFixed(1)}%)</div>
                        <div>Success Rate: {metrics.metrics.position_success_rate?.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              
              {/* Performance Visualizations */}
              <section className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-semibold text-gold">Performance Visualizations</h3>
                  <button 
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/cron/calculate-signals-py', {
                          headers: {
                            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET_KEY || 'public-dev-key'}`
                          }
                        });
                        if (!response.ok) throw new Error('Failed to calculate performance metrics');
                        alert('Performance metrics calculation triggered successfully!');
                      } catch (err) {
                        console.error('Error triggering performance calculation:', err);
                        alert('Failed to trigger performance metrics calculation');
                      }
                    }}
                    className="px-4 py-2 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg text-sm transition-colors"
                  >
                    Recalculate Metrics
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-black/30 p-4 rounded-lg border border-gold/20 card-3d">
                    <h4 className="text-lg font-semibold text-gold mb-2">Timeframe Distribution</h4>
                    <div className="relative aspect-video overflow-hidden rounded-lg border border-gold/10 shadow-md">
                      <div className="card-3d-image">
                        <Image 
                          src="/performances/timeframe_distribution.png" 
                          alt="Timeframe Distribution" 
                          width={400}
                          height={225}
                          className="object-contain"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-black/30 p-4 rounded-lg border border-gold/20 card-3d">
                    <h4 className="text-lg font-semibold text-gold mb-2">Return Distribution</h4>
                    <div className="relative aspect-video overflow-hidden rounded-lg border border-gold/10 shadow-md">
                      <div className="card-3d-image">
                        <Image 
                          src="/performances/return_distribution.png" 
                          alt="Return Distribution" 
                          width={400}
                          height={225}
                          className="object-contain"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-black/30 p-4 rounded-lg border border-gold/20 card-3d">
                    <h4 className="text-lg font-semibold text-gold mb-2">Success by Timeframe</h4>
                    <div className="relative aspect-video overflow-hidden rounded-lg border border-gold/10 shadow-md">
                      <div className="card-3d-image">
                        <Image 
                          src="/performances/success_by_timeframe.png" 
                          alt="Success by Timeframe" 
                          width={400}
                          height={225}
                          className="object-contain"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-black/30 p-4 rounded-lg border border-gold/20 card-3d">
                    <h4 className="text-lg font-semibold text-gold mb-2">Risk-Return Metrics</h4>
                    <div className="relative aspect-video overflow-hidden rounded-lg border border-gold/10 shadow-md">
                      <div className="card-3d-image">
                        <Image 
                          src="/performances/risk_return_metrics.png" 
                          alt="Risk-Return Metrics" 
                          width={400}
                          height={225}
                          className="object-contain"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-black/30 p-4 rounded-lg border border-gold/20 card-3d">
                    <h4 className="text-lg font-semibold text-gold mb-2">Consistency Metrics</h4>
                    <div className="relative aspect-video overflow-hidden rounded-lg border border-gold/10 shadow-md">
                      <div className="card-3d-image">
                        <Image 
                          src="/performances/consistency_metrics.png" 
                          alt="Consistency Metrics" 
                          width={400}
                          height={225}
                          className="object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </section>

      </main>
    </div>
  );
}
