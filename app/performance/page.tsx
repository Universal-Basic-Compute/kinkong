'use client';
import { TradeHistory } from '@/components/tables/TradeHistory'
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
                    <div className="text-gray-400 text-sm mb-1">Total Signals</div>
                    <div className="text-2xl font-bold text-white">{metrics.metrics.total_signals}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      With results: {metrics.metrics.signals_with_results || 0}
                    </div>
                  </div>
                  
                  <div className="bg-black/50 p-4 rounded-lg border border-gold/10">
                    <div className="text-gray-400 text-sm mb-1">Success Rate</div>
                    <div className="text-2xl font-bold text-green-400">
                      {metrics.metrics.success_rate?.toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Win/Loss Ratio: {metrics.metrics.win_loss_ratio?.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="bg-black/50 p-4 rounded-lg border border-gold/10">
                    <div className="text-gray-400 text-sm mb-1">Average Return</div>
                    <div className={`text-2xl font-bold ${metrics.metrics.average_actual_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {metrics.metrics.average_actual_return?.toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Median: {metrics.metrics.median_actual_return?.toFixed(2)}%
                    </div>
                  </div>
                  
                  <div className="bg-black/50 p-4 rounded-lg border border-gold/10">
                    <div className="text-gray-400 text-sm mb-1">Profit Factor</div>
                    <div className="text-2xl font-bold text-gold">
                      {metrics.metrics.profit_factor?.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Sharpe Ratio: {metrics.metrics.sharpe_ratio?.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Advanced Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
                  <h3 className="text-xl font-semibold text-gold mb-4">Risk Metrics</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/50 p-3 rounded-lg border border-gold/10">
                        <div className="text-gray-400 text-xs mb-1">Max Drawdown</div>
                        <div className="text-xl font-bold text-red-400">
                          {metrics.metrics.max_drawdown?.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-black/50 p-3 rounded-lg border border-gold/10">
                        <div className="text-gray-400 text-xs mb-1">Recovery Factor</div>
                        <div className="text-xl font-bold text-green-400">
                          {metrics.metrics.recovery_factor?.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-black/50 p-3 rounded-lg border border-gold/10">
                        <div className="text-gray-400 text-xs mb-1">Average Win</div>
                        <div className="text-xl font-bold text-green-400">
                          {metrics.metrics.average_win?.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-black/50 p-3 rounded-lg border border-gold/10">
                        <div className="text-gray-400 text-xs mb-1">Average Loss</div>
                        <div className="text-xl font-bold text-red-400">
                          {metrics.metrics.average_loss?.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-black/50 p-3 rounded-lg border border-gold/10">
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-gray-400 text-xs">Consistency</div>
                        <div className="text-xs text-gray-300">
                          {metrics.metrics.positive_return_percentage?.toFixed(1)}% positive returns
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-xs text-gray-400">Max Consecutive Wins</div>
                          <div className="text-lg font-bold text-green-400">
                            {metrics.metrics.max_consecutive_wins || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Max Consecutive Losses</div>
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
                  <h3 className="text-xl font-semibold text-gold mb-4">Top Performing Tokens</h3>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
                  <h3 className="text-xl font-semibold text-gold mb-4">Confidence Level Performance</h3>
                  <div className="space-y-4">
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-green-900/50 text-green-400">
                            HIGH
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-semibold inline-block ${metrics.metrics.high_confidence_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {metrics.metrics.high_confidence_return?.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-black/50">
                        <div style={{ width: `${metrics.metrics.high_confidence_percentage}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <div>{metrics.metrics.high_confidence} signals ({metrics.metrics.high_confidence_percentage?.toFixed(1)}%)</div>
                        <div>Success Rate: {metrics.metrics.high_confidence_success_rate?.toFixed(1)}%</div>
                      </div>
                    </div>
                    
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-yellow-900/50 text-yellow-400">
                            MEDIUM
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-semibold inline-block ${metrics.metrics.medium_confidence_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {metrics.metrics.medium_confidence_return?.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-black/50">
                        <div style={{ width: `${metrics.metrics.medium_confidence_percentage}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-yellow-500"></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <div>{metrics.metrics.medium_confidence} signals ({metrics.metrics.medium_confidence_percentage?.toFixed(1)}%)</div>
                        <div>Success Rate: {metrics.metrics.medium_confidence_success_rate?.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Timeframe Performance */}
                <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
                  <h3 className="text-xl font-semibold text-gold mb-4">Timeframe Performance</h3>
                  <div className="space-y-4">
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-blue-900/50 text-blue-400">
                            SCALP
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-semibold inline-block ${metrics.metrics.scalp_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {metrics.metrics.scalp_return?.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-black/50">
                        <div style={{ width: `${metrics.metrics.scalp_percentage}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <div>{metrics.metrics.scalp_signals} signals ({metrics.metrics.scalp_percentage?.toFixed(1)}%)</div>
                        <div>Success Rate: {metrics.metrics.scalp_success_rate?.toFixed(1)}%</div>
                      </div>
                    </div>
                    
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-purple-900/50 text-purple-400">
                            INTRADAY
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-semibold inline-block ${metrics.metrics.intraday_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {metrics.metrics.intraday_return?.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-black/50">
                        <div style={{ width: `${metrics.metrics.intraday_percentage}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-purple-500"></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <div>{metrics.metrics.intraday_signals} signals ({metrics.metrics.intraday_percentage?.toFixed(1)}%)</div>
                        <div>Success Rate: {metrics.metrics.intraday_success_rate?.toFixed(1)}%</div>
                      </div>
                    </div>
                    
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-teal-900/50 text-teal-400">
                            SWING
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-semibold inline-block ${metrics.metrics.swing_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {metrics.metrics.swing_return?.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-black/50">
                        <div style={{ width: `${metrics.metrics.swing_percentage}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-teal-500"></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <div>{metrics.metrics.swing_signals} signals ({metrics.metrics.swing_percentage?.toFixed(1)}%)</div>
                        <div>Success Rate: {metrics.metrics.swing_success_rate?.toFixed(1)}%</div>
                      </div>
                    </div>
                    
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-indigo-900/50 text-indigo-400">
                            POSITION
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-semibold inline-block ${metrics.metrics.position_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {metrics.metrics.position_return?.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-black/50">
                        <div style={{ width: `${metrics.metrics.position_percentage}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500"></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <div>{metrics.metrics.position_signals} signals ({metrics.metrics.position_percentage?.toFixed(1)}%)</div>
                        <div>Success Rate: {metrics.metrics.position_success_rate?.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              
              {/* Visualization Links */}
              <div className="bg-black/30 p-6 rounded-lg border border-gold/20 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gold">Performance Visualizations</h3>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-black/50 p-4 rounded-lg border border-gold/10 hover:border-gold/30 transition-colors">
                    <div className="text-gold font-medium mb-1">Confidence Distribution</div>
                    <div className="text-xs text-gray-400">Distribution of signal confidence levels</div>
                  </div>
                  <div className="bg-black/50 p-4 rounded-lg border border-gold/10 hover:border-gold/30 transition-colors">
                    <div className="text-gold font-medium mb-1">Timeframe Distribution</div>
                    <div className="text-xs text-gray-400">Breakdown by trading timeframe</div>
                  </div>
                  <div className="bg-black/50 p-4 rounded-lg border border-gold/10 hover:border-gold/30 transition-colors">
                    <div className="text-gold font-medium mb-1">Return Distribution</div>
                    <div className="text-xs text-gray-400">Expected vs actual returns</div>
                  </div>
                  <div className="bg-black/50 p-4 rounded-lg border border-gold/10 hover:border-gold/30 transition-colors">
                    <div className="text-gold font-medium mb-1">Success by Confidence</div>
                    <div className="text-xs text-gray-400">Success rate by confidence level</div>
                  </div>
                  <div className="bg-black/50 p-4 rounded-lg border border-gold/10 hover:border-gold/30 transition-colors">
                    <div className="text-gold font-medium mb-1">Success by Timeframe</div>
                    <div className="text-xs text-gray-400">Success rate by trading timeframe</div>
                  </div>
                  <div className="bg-black/50 p-4 rounded-lg border border-gold/10 hover:border-gold/30 transition-colors">
                    <div className="text-gold font-medium mb-1">Top Tokens Performance</div>
                    <div className="text-xs text-gray-400">Performance of most traded tokens</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Trade History */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gold mb-4">Recent Trades</h2>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            <TradeHistory />
          </div>
        </section>
      </main>
    </div>
  );
}
