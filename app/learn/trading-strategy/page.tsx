import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

const TradingStrategyPage = () => {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden mb-12 border border-gold/20 shadow-lg shadow-gold/10">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/80 z-10"></div>
        <div className="absolute inset-0 bg-[url('/images/trading-strategy-bg.jpg')] bg-cover bg-center opacity-30"></div>
        <div className="relative z-20 py-16 px-8 sm:px-16 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 electric-title">
            KinKong Trading Strategy
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl">
            Discover how KinKong identifies opportunities, executes trades, and manages risk in the Solana ecosystem
          </p>
        </div>
      </div>

      {/* Strategy Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {strategyPillars.map((pillar, index) => (
          <div 
            key={index}
            className="relative overflow-hidden rounded-xl border border-gold/20 bg-black/50 p-6 hover:shadow-lg hover:shadow-gold/10 transition-all duration-300 group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-transparent z-0"></div>
            <div className="relative z-10">
              <div className="text-4xl mb-4">{pillar.icon}</div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-gold transition-colors">{pillar.title}</h3>
              <p className="text-gray-400">{pillar.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Strategy Diagram */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            The KinKong Trading Cycle
          </span>
        </h2>
        
        <div className="relative rounded-xl border border-gold/20 bg-black/50 p-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            {tradingCycle.map((step, index) => (
              <div key={index} className="flex flex-col items-center text-center max-w-xs">
                <div className="w-16 h-16 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-2xl mb-4">
                  {step.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400">{step.description}</p>
                
                {index < tradingCycle.length - 1 && (
                  <div className="hidden md:block absolute transform translate-x-[140px] translate-y-[-20px]">
                    <svg width="80" height="20" viewBox="0 0 80 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M0 10H75" stroke="#FFD700" strokeOpacity="0.3" strokeWidth="1" />
                      <path d="M70 5L75 10L70 15" stroke="#FFD700" strokeOpacity="0.3" strokeWidth="1" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Discovery Strategies Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Token Discovery Strategies
          </span>
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {discoveryStrategies.map((strategy, index) => (
            <div 
              key={index}
              className="rounded-xl border border-gold/20 bg-black/50 p-6 hover:shadow-lg hover:shadow-gold/10 transition-all duration-300"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-xl mr-4">
                  {strategy.icon}
                </div>
                <h3 className="text-xl font-bold">{strategy.title}</h3>
              </div>
              <p className="text-gray-400 mb-4">{strategy.description}</p>
              <div className="bg-black/60 rounded-lg p-4 border border-gray-800">
                <h4 className="text-sm font-semibold text-gold mb-2">Key Parameters:</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  {strategy.parameters.map((param, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      {param}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trading Schedule Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Trading Schedule & Timeframes
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4">Trading Windows (4x Daily)</h3>
            <div className="space-y-4">
              {tradingWindows.map((window, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-sm mr-4">
                    {window.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold">{window.name}</h4>
                    <p className="text-sm text-gray-400">{window.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4">Why 4x Daily Trading?</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Captures price movements across different time zones</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Smaller position sizes reduce exposure to sudden market moves</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Solana's fast block times make frequent trading cost-effective</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>More entry/exit points to capitalize on short-term movements</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tradingTimeframes.map((timeframe, index) => (
            <div 
              key={index}
              className="rounded-xl border border-gold/20 bg-black/50 p-5 hover:shadow-lg hover:shadow-gold/10 transition-all duration-300"
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold">{timeframe.name}</h3>
                <span className="text-sm px-2 py-1 rounded bg-black/70 border border-gold/30">
                  {timeframe.duration}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Chart Interval:</span>
                  <span>{timeframe.chartInterval}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Profit Target:</span>
                  <span className="text-green-500">{timeframe.profitTarget}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Stop Loss:</span>
                  <span className="text-red-500">{timeframe.stopLoss}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart Analysis Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Chart Analysis Integration
          </span>
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4">How KinKong Analyzes Charts</h3>
            <p className="text-gray-300 mb-4">
              KinKong uses advanced AI vision analysis to extract insights from price charts, optimizing trade execution and identifying key levels.
            </p>
            
            <div className="space-y-4">
              {chartAnalysisFeatures.map((feature, index) => (
                <div key={index} className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-sm mr-3 mt-1 flex-shrink-0">
                    {feature.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold">{feature.title}</h4>
                    <p className="text-sm text-gray-400">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4">AI Analysis Output</h3>
            <div className="bg-black/80 rounded-lg p-4 border border-gray-800 font-mono text-sm overflow-x-auto">
              <pre className="text-gray-300">
{`{
  "sentiment": "BULLISH",
  "confidence": 85,
  "keyLevels": {
    "support": ["$0.95", "$0.92", "$0.88"],
    "resistance": ["$1.02", "$1.08", "$1.15"]
  },
  "patterns": ["Cup and Handle", "Golden Cross"],
  "tradingRecommendation": {
    "action": "EXECUTE",
    "reason": "Strong uptrend with volume confirmation"
  }
}`}
              </pre>
            </div>
            
            <div className="mt-6 space-y-3">
              <h4 className="font-semibold">Execution Modifications:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {executionActions.map((action, index) => (
                  <div key={index} className="bg-black/60 rounded-lg p-3 border border-gray-800 text-center">
                    <div className="text-xl mb-1">{action.icon}</div>
                    <div className="font-semibold text-sm">{action.name}</div>
                    <div className="text-xs text-gray-400">{action.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Management Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Risk Management Framework
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {riskManagementPillars.map((pillar, index) => (
              <div key={index} className="space-y-4">
                <div className="w-14 h-14 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-2xl">
                  {pillar.icon}
                </div>
                <h3 className="text-xl font-bold">{pillar.title}</h3>
                <p className="text-gray-400">{pillar.description}</p>
                <ul className="space-y-2">
                  {pillar.points.map((point, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span className="text-sm text-gray-300">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
const strategyPillars = [
  {
    icon: '🔍',
    title: 'Token Discovery',
    description: 'Multiple strategies to identify promising tokens with significant growth potential'
  },
  {
    icon: '⏱️',
    title: '4x Daily Trading',
    description: 'Optimized trading frequency to capture opportunities across global market sessions'
  },
  {
    icon: '📊',
    title: 'AI Chart Analysis',
    description: 'Advanced pattern recognition and level identification for optimal entry and exit'
  }
];

const tradingCycle = [
  {
    icon: '🔍',
    title: 'Token Discovery',
    description: 'Identify promising tokens using multiple discovery strategies'
  },
  {
    icon: '📊',
    title: 'Analysis',
    description: 'Analyze price action, volume, and chart patterns across timeframes'
  },
  {
    icon: '🎯',
    title: 'Signal Generation',
    description: 'Generate trading signals with precise entry, target, and stop levels'
  },
  {
    icon: '💰',
    title: 'Execution',
    description: 'Execute trades with optimal sizing based on market conditions'
  },
  {
    icon: '⚖️',
    title: 'Risk Management',
    description: 'Monitor positions and adjust based on performance and market changes'
  }
];

const discoveryStrategies = [
  {
    icon: '📈',
    title: 'Volume Momentum Strategy',
    description: 'Identify tokens with significant trading activity growth that may indicate emerging trends',
    parameters: [
      'Sort by 24-hour volume growth percentage',
      'Minimum liquidity: $100K',
      'Minimum 24h volume: $50K',
      'Minimum holders: 500'
    ]
  },
  {
    icon: '🆕',
    title: 'Recent Listings with Traction',
    description: 'Discover newly listed tokens that are gaining significant market attention and liquidity',
    parameters: [
      'Sort by listing time (newest first)',
      'Minimum liquidity: $200K',
      'Minimum 24h trades: 500',
      'Minimum holders: 300'
    ]
  },
  {
    icon: '🚀',
    title: 'Price Momentum with Volume',
    description: 'Find tokens with strong price performance backed by increasing trading volume',
    parameters: [
      'Sort by 24-hour price change percentage',
      'Minimum 24h volume: $100K',
      'Minimum volume growth: 20%',
      'Minimum liquidity: $300K'
    ]
  },
  {
    icon: '💧',
    title: 'Liquidity Growth Detector',
    description: 'Find tokens that are rapidly gaining liquidity, which often precedes major price movements',
    parameters: [
      'Sort by total liquidity',
      'Market cap range: $1M-$100M',
      'Minimum holders: 1,000',
      'Minimum 24h volume: $200K'
    ]
  }
];

const tradingWindows = [
  {
    icon: '🌏',
    name: 'Asian Window',
    time: '00:00 UTC ±30min'
  },
  {
    icon: '🇪🇺',
    name: 'European Window',
    time: '06:00 UTC ±30min'
  },
  {
    icon: '🌐',
    name: 'Overlap Window',
    time: '12:00 UTC ±30min'
  },
  {
    icon: '🇺🇸',
    name: 'American Window',
    time: '18:00 UTC ±30min'
  }
];

const tradingTimeframes = [
  {
    name: 'SCALP',
    duration: '6 hours',
    chartInterval: '15m candles',
    profitTarget: '12%',
    stopLoss: '10%'
  },
  {
    name: 'INTRADAY',
    duration: '24 hours',
    chartInterval: '1h candles',
    profitTarget: '15%',
    stopLoss: '15%'
  },
  {
    name: 'SWING',
    duration: '7 days',
    chartInterval: '4h candles',
    profitTarget: '20%',
    stopLoss: '20%'
  },
  {
    name: 'POSITION',
    duration: '30 days',
    chartInterval: 'Daily candles',
    profitTarget: '25%',
    stopLoss: '25%'
  }
];

const chartAnalysisFeatures = [
  {
    icon: '📏',
    title: 'Support & Resistance',
    description: 'Identifies key price levels for optimal entry and exit points'
  },
  {
    icon: '📋',
    title: 'Pattern Recognition',
    description: 'Detects chart patterns like triangles, flags, and head & shoulders'
  },
  {
    icon: '📊',
    title: 'Volume Analysis',
    description: 'Evaluates volume patterns to confirm price movements'
  },
  {
    icon: '🔍',
    title: 'Trend Direction',
    description: 'Determines the immediate trend direction and strength'
  }
];

const executionActions = [
  {
    icon: '✅',
    name: 'EXECUTE',
    description: 'Proceed with planned trade'
  },
  {
    icon: '⏱️',
    name: 'DELAY',
    description: 'Wait up to 30min for better level'
  },
  {
    icon: '⛔',
    name: 'SKIP',
    description: 'Cancel if technically unfavorable'
  }
];

const riskManagementPillars = [
  {
    icon: '⚖️',
    title: 'Position Sizing',
    description: 'Dynamic sizing based on market conditions',
    points: [
      'Smaller positions in bearish markets',
      'Larger positions in bullish markets',
      'Maximum 5% allocation to any token',
      'Minimum liquidity requirement: 3x position size'
    ]
  },
  {
    icon: '🛡️',
    title: 'Stop Loss Strategy',
    description: 'Systematic approach to limiting downside',
    points: [
      'Timeframe-specific stop loss levels',
      'Trailing stops for winning trades',
      'Maximum drawdown thresholds',
      'Automatic execution at predetermined levels'
    ]
  },
  {
    icon: '📊',
    title: 'Portfolio Balance',
    description: 'Maintaining optimal exposure across assets',
    points: [
      'Market-driven allocation between tokens, SOL, and stables',
      'Regular rebalancing every 6 hours',
      'Emergency rebalancing during extreme volatility',
      'Correlation analysis to avoid concentrated risk'
    ]
  }
];

const nextPages = [
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
  },
  {
    icon: '🔍',
    title: 'Token Discovery',
    description: 'How KinKong finds promising tokens',
    href: '/learn/token-discovery'
  }
];

export default TradingStrategyPage;
