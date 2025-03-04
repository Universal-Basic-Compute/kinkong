import React from 'react';
import Link from 'next/link';

const TokenDiscoveryPage = () => {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden mb-12 border border-gold/20 shadow-lg shadow-gold/10">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/80 z-10"></div>
        <div className="absolute inset-0 bg-[url('/images/token-discovery-bg.jpg')] bg-cover bg-center opacity-30"></div>
        <div className="relative z-20 py-16 px-8 sm:px-16 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 electric-title">
            Token Discovery Strategies
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl">
            How KinKong identifies promising tokens in the Solana ecosystem before they gain mainstream attention
          </p>
        </div>
      </div>

      {/* Overview Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Overview
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <p className="text-lg text-gray-300 mb-6">
            KinKong employs multiple discovery strategies to identify promising tokens in the Solana ecosystem. 
            These strategies leverage the Birdeye API to filter and rank tokens based on various metrics, 
            allowing us to find opportunities before they gain mainstream attention.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-lg border border-gold/10 bg-black/70 p-6">
              <h3 className="text-xl font-bold mb-3 text-gold">API Integration</h3>
              <p className="text-gray-300 mb-4">All strategies use the Birdeye API's token list endpoint with different parameters:</p>
              <div className="bg-black/80 rounded-lg p-4 border border-gray-800 font-mono text-sm overflow-x-auto">
                <pre className="text-gray-300">
                  GET https://public-api.birdeye.so/defi/v3/token/list
                </pre>
              </div>
            </div>
            
            <div className="rounded-lg border border-gold/10 bg-black/70 p-6">
              <h3 className="text-xl font-bold mb-3 text-gold">Discovery Pipeline</h3>
              <ol className="space-y-2 text-gray-300">
                <li className="flex items-start">
                  <span className="text-gold mr-2">1.</span>
                  <span>Initial Discovery: Run API queries according to strategy schedules</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">2.</span>
                  <span>First-Level Filtering: Apply minimum criteria from API parameters</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">3.</span>
                  <span>Second-Level Filtering: Manual review of fundamentals and on-chain metrics</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">4.</span>
                  <span>Tracking: Add promising tokens to watchlist with discovery source tagged</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">5.</span>
                  <span>Analysis: Run technical analysis on watchlist tokens</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">6.</span>
                  <span>Integration: Add selected tokens to active trading portfolio</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Discovery Strategies */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Discovery Strategies
          </span>
        </h2>
        
        <div className="space-y-8">
          {discoveryStrategies.map((strategy, index) => (
            <div 
              key={index}
              className="rounded-xl border border-gold/20 bg-black/50 p-6 hover:shadow-lg hover:shadow-gold/10 transition-all duration-300"
            >
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="md:w-1/3">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-xl mr-4">
                      {strategy.icon}
                    </div>
                    <h3 className="text-xl font-bold">{strategy.title}</h3>
                  </div>
                  <p className="text-gray-400 mb-4">{strategy.description}</p>
                  
                  <div className="bg-black/60 rounded-lg p-4 border border-gray-800 mb-4">
                    <h4 className="text-sm font-semibold text-gold mb-2">Purpose:</h4>
                    <p className="text-sm text-gray-300">{strategy.purpose}</p>
                  </div>
                </div>
                
                <div className="md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-black/60 rounded-lg p-4 border border-gray-800">
                    <h4 className="text-sm font-semibold text-gold mb-2">API Parameters:</h4>
                    <ul className="text-sm text-gray-400 space-y-1 font-mono">
                      {strategy.parameters.map((param, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-gold mr-2">•</span>
                          {param}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-black/60 rounded-lg p-4 border border-gray-800">
                    <h4 className="text-sm font-semibold text-gold mb-2">Implementation Strategy:</h4>
                    <ul className="text-sm text-gray-400 space-y-1">
                      {strategy.implementation.map((step, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-gold mr-2">•</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-black/60 rounded-lg p-4 border border-gray-800">
                    <h4 className="text-sm font-semibold text-gold mb-2">Risk Management:</h4>
                    <ul className="text-sm text-gray-400 space-y-1">
                      {strategy.riskManagement.map((risk, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-gold mr-2">•</span>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-black/60 rounded-lg p-4 border border-gray-800">
                    <h4 className="text-sm font-semibold text-gold mb-2">Schedule:</h4>
                    <p className="text-sm text-gray-300">{strategy.schedule}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Management Framework */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Risk Management Framework
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 text-gold">General Principles</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Higher thresholds during bearish market conditions</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Adjust liquidity requirements based on intended position size</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Additional verification for newly listed tokens</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Consider holder concentration metrics</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-xl font-bold mb-4 text-gold">Strategy-Specific Adjustments</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>For Recent Listings: Start with 25% of standard position size</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>For Price Momentum: Reduce allocation for tokens up {'>'}30% in 24h</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>For all strategies: Maximum 5% allocation to any single token</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>For High Activity: Verify activity is not from a small number of wallets</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Performance Metrics
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <p className="text-lg text-gray-300 mb-6">
            We track the following metrics for each discovery strategy to continuously optimize our approach:
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {performanceMetrics.map((metric, index) => (
              <div 
                key={index}
                className="rounded-lg border border-gold/10 bg-black/70 p-5"
              >
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-lg mr-3">
                    {metric.icon}
                  </div>
                  <h3 className="text-lg font-bold">{metric.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{metric.description}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-black/60 rounded-lg border border-gray-800">
            <p className="text-center text-gray-300">
              Strategy performance is reviewed monthly and parameters are adjusted accordingly to optimize discovery effectiveness.
            </p>
          </div>
        </div>
      </div>

      {/* Automation Schedule */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Automation Schedule
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="py-3 px-4 text-gold">Strategy</th>
                  <th className="py-3 px-4 text-gold">Frequency</th>
                  <th className="py-3 px-4 text-gold">Time (UTC)</th>
                  <th className="py-3 px-4 text-gold">Focus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {automationSchedule.map((item, index) => (
                  <tr key={index} className="hover:bg-black/40">
                    <td className="py-3 px-4 text-gray-300">{item.strategy}</td>
                    <td className="py-3 px-4 text-gray-300">{item.frequency}</td>
                    <td className="py-3 px-4 text-gray-300">{item.time}</td>
                    <td className="py-3 px-4 text-gray-300">{item.focus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="rounded-xl border border-gold/20 bg-black/50 p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Learn More?</h2>
        <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
          Explore other aspects of KinKong's trading approach to gain a comprehensive understanding of our strategy.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {nextPages.map((page, index) => (
            <Link 
              key={index}
              href={page.href}
              className="rounded-lg border border-gold/20 bg-black/70 p-4 hover:bg-black/90 hover:border-gold/40 transition-all duration-300 flex items-center"
            >
              <div className="w-10 h-10 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-lg mr-3">
                {page.icon}
              </div>
              <div className="text-left">
                <h3 className="font-semibold">{page.title}</h3>
                <p className="text-xs text-gray-400">{page.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

// Data for the page
const discoveryStrategies = [
  {
    icon: '📈',
    title: 'Volume Momentum Strategy',
    description: 'Identify tokens with significant trading activity growth',
    purpose: 'Identify tokens with significant trading activity growth that may indicate emerging trends or market interest.',
    parameters: [
      'sort_by=volume_24h_change_percent',
      'sort_type=desc',
      'min_liquidity=100000',
      'min_volume_24h_usd=50000',
      'min_holder=500',
      'limit=20'
    ],
    implementation: [
      'Run this query daily at the same time',
      'Track tokens that appear in the top 20 for 3+ consecutive days',
      'Research fundamentals of these tokens before considering them for the portfolio',
      'Prioritize tokens with consistent volume growth across multiple timeframes (24h, 8h, 4h)'
    ],
    riskManagement: [
      'Exclude tokens with suspicious volume patterns (sudden spikes followed by drops)',
      'Verify volume is distributed across multiple DEXs/pools',
      'Check holder concentration metrics'
    ],
    schedule: 'Daily at 00:00 UTC'
  },
  {
    icon: '🆕',
    title: 'Recent Listings with Traction',
    description: 'Discover newly listed tokens that are gaining significant market attention',
    purpose: 'Discover newly listed tokens that are gaining significant market attention and liquidity.',
    parameters: [
      'sort_by=recent_listing_time',
      'sort_type=desc',
      'min_liquidity=200000',
      'min_trade_24h_count=500',
      'min_holder=300',
      'limit=30'
    ],
    implementation: [
      'Run this query twice weekly',
      'Monitor new listings that maintain or grow their liquidity for 7+ days',
      'Compare trade count trends to identify sustained interest',
      'Prioritize tokens that show organic growth patterns rather than artificial pumps'
    ],
    riskManagement: [
      'Implement stricter position size limits for newer tokens',
      'Require minimum 7-day history before significant allocation',
      'Verify team and project information thoroughly'
    ],
    schedule: 'Monday and Thursday at 12:00 UTC'
  },
  {
    icon: '🚀',
    title: 'Price Momentum with Volume Confirmation',
    description: 'Find tokens with strong price performance backed by increasing volume',
    purpose: 'Identify tokens with strong price performance backed by increasing trading volume.',
    parameters: [
      'sort_by=price_change_24h_percent',
      'sort_type=desc',
      'min_volume_24h_usd=100000',
      'min_volume_24h_change_percent=20',
      'min_liquidity=300000',
      'min_trade_24h_count=700',
      'limit=25'
    ],
    implementation: [
      'Run this query daily after major market sessions',
      'Look for tokens appearing consistently across multiple timeframes',
      'Compare 4h, 8h, and 24h price changes to identify sustainable momentum',
      'Prioritize tokens where volume growth exceeds or matches price growth'
    ],
    riskManagement: [
      'Avoid chasing tokens already up significantly (>50% in 24h)',
      'Verify price action against broader market trends',
      'Check for unusual wallet activity or wash trading'
    ],
    schedule: 'Daily at 08:00 UTC and 20:00 UTC'
  },
  {
    icon: '💧',
    title: 'Liquidity Growth Detector',
    description: 'Find tokens that are rapidly gaining liquidity',
    purpose: 'Find tokens that are rapidly gaining liquidity, which often precedes major price movements.',
    parameters: [
      'sort_by=liquidity',
      'sort_type=desc',
      'min_market_cap=1000000',
      'max_market_cap=100000000',
      'min_holder=1000',
      'min_volume_24h_usd=200000',
      'limit=50'
    ],
    implementation: [
      'Run this query weekly and track changes in rankings',
      'Identify tokens moving up the liquidity rankings rapidly',
      'Calculate liquidity-to-market-cap ratios to find undervalued tokens',
      'Prioritize tokens with growing holder counts and increasing trade frequency'
    ],
    riskManagement: [
      'Verify liquidity is distributed across multiple pools',
      'Check for single-wallet liquidity provision',
      'Monitor liquidity stability over 7-day period'
    ],
    schedule: 'Weekly on Friday at 16:00 UTC'
  },
  {
    icon: '🔄',
    title: 'High Trading Activity Filter',
    description: 'Discover tokens with unusually high trading activity relative to market cap',
    purpose: 'Discover tokens with unusually high trading activity relative to their market cap.',
    parameters: [
      'sort_by=trade_24h_count',
      'sort_type=desc',
      'min_liquidity=150000',
      'min_volume_24h_usd=75000',
      'min_holder=400',
      'limit=30'
    ],
    implementation: [
      'Run this query daily',
      'Calculate the ratio of trade count to market cap to find unusually active tokens',
      'Look for tokens with consistently high trading activity across multiple days',
      'Prioritize tokens where trading activity is growing week-over-week'
    ],
    riskManagement: [
      'Verify trade count distribution (should be spread across time periods)',
      'Check for bot activity or wash trading patterns',
      'Compare with historical activity levels'
    ],
    schedule: 'Daily at 04:00 UTC'
  }
];

const performanceMetrics = [
  {
    icon: '🎯',
    title: 'Win Rate',
    description: 'Percentage of discovered tokens that achieve profit target'
  },
  {
    icon: '💰',
    title: 'Average ROI',
    description: 'Average return on investment per token from each strategy'
  },
  {
    icon: '⏱️',
    title: 'Time to First Move',
    description: 'How quickly tokens achieve significant price movement (>10%)'
  },
  {
    icon: '📊',
    title: 'Holding Period',
    description: 'Optimal holding duration for maximum profit'
  },
  {
    icon: '🔄',
    title: 'Market Correlation',
    description: 'How strategy performance correlates with market conditions'
  },
  {
    icon: '❌',
    title: 'False Positive Rate',
    description: 'Percentage of tokens that meet criteria but perform poorly'
  }
];

const automationSchedule = [
  {
    strategy: 'Volume Momentum',
    frequency: 'Daily',
    time: '00:00 UTC',
    focus: 'Trading activity growth'
  },
  {
    strategy: 'Recent Listings',
    frequency: 'Twice Weekly',
    time: 'Monday/Thursday 12:00 UTC',
    focus: 'New tokens with traction'
  },
  {
    strategy: 'Price Momentum',
    frequency: 'Twice Daily',
    time: '08:00 UTC and 20:00 UTC',
    focus: 'Price action with volume confirmation'
  },
  {
    strategy: 'Liquidity Growth',
    frequency: 'Weekly',
    time: 'Friday 16:00 UTC',
    focus: 'Increasing liquidity metrics'
  },
  {
    strategy: 'High Activity',
    frequency: 'Daily',
    time: '04:00 UTC',
    focus: 'Trading frequency relative to market cap'
  }
];

const nextPages = [
  {
    icon: '📊',
    title: 'Trading Strategy',
    description: 'KinKong\'s core trading approach',
    href: '/learn/trading-strategy'
  },
  {
    icon: '🧠',
    title: 'Market Sentiment',
    description: 'How KinKong classifies market conditions',
    href: '/learn/market-sentiment'
  },
  {
    icon: '⚖️',
    title: 'Trade Sizing',
    description: 'Dynamic position sizing methodology',
    href: '/learn/trade-sizing'
  }
];

export default TokenDiscoveryPage;
