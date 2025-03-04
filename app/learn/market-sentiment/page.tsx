import React from 'react';
import Link from 'next/link';

const MarketSentimentPage = () => {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden mb-12 border border-gold/20 shadow-lg shadow-gold/10">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/80 z-10"></div>
        <div className="absolute inset-0 bg-[url('/images/market-sentiment-bg.jpg')] bg-cover bg-center opacity-30"></div>
        <div className="relative z-20 py-16 px-8 sm:px-16 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 electric-title">
            Market Sentiment Analysis
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl">
            How KinKong classifies market conditions to optimize trading strategy and portfolio allocation
          </p>
        </div>
      </div>

      {/* Overview Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            The Core Concept
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8 mb-8">
          <p className="text-lg text-gray-300 mb-6">
            KinKong uses a multi-indicator approach that analyzes four key aspects of market behavior over a 7-day period. 
            Each indicator is designed to capture different market dynamics while being reliable and data-driven.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-lg border border-gold/10 bg-black/70 p-6">
              <h3 className="text-xl font-bold mb-3 text-gold">Why Weekly Analysis?</h3>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Filters out daily noise and volatility</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Captures meaningful market trends</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Provides stable framework for portfolio allocation</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Balances reactivity with strategic positioning</span>
                </li>
              </ul>
            </div>
            
            <div className="rounded-lg border border-gold/10 bg-black/70 p-6">
              <h3 className="text-xl font-bold mb-3 text-gold">Portfolio Impact</h3>
              <p className="text-gray-300 mb-3">The weekly sentiment directly influences portfolio allocation:</p>
              <div className="space-y-3">
                <div className="p-3 rounded bg-green-950/30 border border-green-800/30">
                  <p className="font-semibold text-green-400">BULLISH Market:</p>
                  <p className="text-gray-300">AI Tokens: 70% | SOL: 20% | Stables: 10%</p>
                </div>
                <div className="p-3 rounded bg-blue-950/30 border border-blue-800/30">
                  <p className="font-semibold text-blue-400">NEUTRAL Market:</p>
                  <p className="text-gray-300">AI Tokens: 50% | SOL: 20% | Stables: 30%</p>
                </div>
                <div className="p-3 rounded bg-red-950/30 border border-red-800/30">
                  <p className="font-semibold text-red-400">BEARISH Market:</p>
                  <p className="text-gray-300">AI Tokens: 30% | SOL: 10% | Stables: 60%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Four Key Indicators */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            The Four Key Indicators
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {indicators.map((indicator, index) => (
            <div 
              key={index}
              className="rounded-xl border border-gold/20 bg-black/50 p-6 hover:shadow-lg hover:shadow-gold/10 transition-all duration-300"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-xl mr-4">
                  {indicator.icon}
                </div>
                <h3 className="text-xl font-bold">{indicator.title}</h3>
              </div>
              <p className="text-gray-400 mb-4">{indicator.description}</p>
              
              <div className="space-y-4">
                <div className="bg-black/60 rounded-lg p-4 border border-gray-800">
                  <h4 className="text-sm font-semibold text-gold mb-2">Calculation:</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    {indicator.calculation.map((step, i) => (
                      <li key={i} className="flex items-start">
                        <span className="text-gold mr-2">•</span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="bg-black/60 rounded-lg p-4 border border-gray-800">
                  <h4 className="text-sm font-semibold text-gold mb-2">Classification:</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    {indicator.classification.map((rule, i) => (
                      <li key={i} className="flex items-start">
                        <span className="text-gold mr-2">•</span>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Classification Rules */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Overall Classification Rules
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="rounded-xl border border-green-800/30 bg-green-950/20 p-6">
            <h3 className="text-xl font-bold mb-4 text-green-400">Bullish Week Requirements</h3>
            <p className="text-gray-300 mb-3">Need at least 3 of these 4 conditions:</p>
            <ol className="space-y-2 text-gray-300">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">1.</span>
                <span>{'>'}60% of AI tokens above 7-day average</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">2.</span>
                <span>Weekly volume higher than previous week</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">3.</span>
                <span>{'>'}60% of volume on up days</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">4.</span>
                <span>{'>'}60% of POSITION signals are BUY</span>
              </li>
            </ol>
          </div>
          
          <div className="rounded-xl border border-blue-800/30 bg-blue-950/20 p-6">
            <h3 className="text-xl font-bold mb-4 text-blue-400">Neutral Classification</h3>
            <p className="text-gray-300 mb-3">When neither bullish nor bearish conditions are met:</p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Usually indicates transitional periods</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Market consolidation phases</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Mixed signals across indicators</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span>Balanced risk/reward environment</span>
              </li>
            </ul>
          </div>
          
          <div className="rounded-xl border border-red-800/30 bg-red-950/20 p-6">
            <h3 className="text-xl font-bold mb-4 text-red-400">Bearish Week Requirements</h3>
            <p className="text-gray-300 mb-3">Need at least 3 of these 4 conditions:</p>
            <ol className="space-y-2 text-gray-300">
              <li className="flex items-start">
                <span className="text-red-400 mr-2">1.</span>
                <span>{'<'}40% of AI tokens above 7-day average</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-400 mr-2">2.</span>
                <span>Weekly volume lower than previous week</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-400 mr-2">3.</span>
                <span>{'>'}60% of volume on down days</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-400 mr-2">4.</span>
                <span>{'<'}40% of POSITION signals are BUY</span>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Example Calculation */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Example Calculation
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <h3 className="text-xl font-bold mb-4">Sample Week Analysis</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-black/60 rounded-lg p-4 border border-gray-800">
                <h4 className="font-semibold text-green-400 mb-2">Price Action:</h4>
                <ul className="text-gray-300 space-y-1">
                  <li>7 out of 10 tokens above average (70%)</li>
                  <li className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    <span>BULLISH</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-black/60 rounded-lg p-4 border border-gray-800">
                <h4 className="font-semibold text-green-400 mb-2">Volume Analysis:</h4>
                <ul className="text-gray-300 space-y-1">
                  <li>Weekly volume up 15% ✓</li>
                  <li>65% volume on up days ✓</li>
                  <li className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    <span>BULLISH</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-black/60 rounded-lg p-4 border border-gray-800">
                <h4 className="font-semibold text-green-400 mb-2">Relative Strength:</h4>
                <ul className="text-gray-300 space-y-1">
                  <li>AI tokens: +12%</li>
                  <li>SOL: +8%</li>
                  <li className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    <span>BULLISH</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-black/60 rounded-lg p-4 border border-gray-800">
                <h4 className="font-semibold text-blue-400 mb-2">POSITION Signals:</h4>
                <ul className="text-gray-300 space-y-1">
                  <li>Total signals: 5</li>
                  <li>BUY signals: 2 (40%)</li>
                  <li className="flex items-center">
                    <span className="text-blue-400 mr-2">❍</span>
                    <span>NEUTRAL</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="mt-8 p-6 bg-green-950/30 border border-green-800/30 rounded-lg">
            <h4 className="text-xl font-bold text-green-400 mb-2">Final Classification:</h4>
            <ul className="text-gray-300 space-y-1">
              <li>3 BULLISH indicators</li>
              <li>1 NEUTRAL indicator</li>
              <li className="text-xl font-bold text-green-400 mt-2">= BULLISH WEEK</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Why This Approach?
          </span>
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {benefits.map((benefit, index) => (
            <div 
              key={index}
              className="rounded-xl border border-gold/20 bg-black/50 p-6 hover:shadow-lg hover:shadow-gold/10 transition-all duration-300"
            >
              <div className="text-3xl mb-4">{benefit.icon}</div>
              <h3 className="text-lg font-bold mb-2">{benefit.title}</h3>
              <p className="text-sm text-gray-400">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Real-World Application */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Real-World Application
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <p className="text-lg text-gray-300 mb-6">
            The sentiment classification runs every Friday and determines the next week's:
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {applications.map((app, index) => (
              <div 
                key={index}
                className="rounded-lg border border-gold/10 bg-black/70 p-4 flex flex-col items-center text-center"
              >
                <div className="text-3xl mb-3">{app.icon}</div>
                <h3 className="text-lg font-bold mb-2">{app.title}</h3>
                <p className="text-sm text-gray-400">{app.description}</p>
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
const indicators = [
  {
    icon: '📈',
    title: 'Price Action Analysis',
    description: 'Looks at how AI tokens are performing relative to their recent history',
    calculation: [
      'Track all active AI tokens\' prices',
      'Compare current price to 7-day average',
      'Calculate percentage above average'
    ],
    classification: [
      'BULLISH: >60% tokens above average',
      'BEARISH: <40% tokens above average',
      'NEUTRAL: 40-60% tokens above average'
    ]
  },
  {
    icon: '📊',
    title: 'Volume Trend Analysis',
    description: 'Examines trading activity and its direction',
    calculation: [
      'Sum total weekly volume',
      'Compare to previous week\'s volume',
      'Analyze volume on up vs down days'
    ],
    classification: [
      'BULLISH: Current week volume > Previous week',
      'BULLISH: >60% volume on up days',
      'BEARISH: Current week volume < Previous week',
      'BEARISH: >60% volume on down days'
    ]
  },
  {
    icon: '💪',
    title: 'Relative Strength vs SOL',
    description: 'Compares AI token performance against SOL',
    calculation: [
      'Calculate median AI token performance',
      'Compare to SOL\'s performance',
      'Determine outperformance percentage'
    ],
    classification: [
      'BULLISH: AI tokens outperforming SOL',
      'BEARISH: AI tokens underperforming SOL',
      'NEUTRAL: Similar performance (±2%)'
    ]
  },
  {
    icon: '🎯',
    title: 'POSITION Signals Analysis',
    description: 'Analyzes our long-term trading signals',
    calculation: [
      'Count HIGH confidence POSITION signals from last 7 days',
      'Calculate percentage of BUY vs SELL signals',
      'Minimum 3 signals required'
    ],
    classification: [
      'BULLISH: >60% BUY signals',
      'BEARISH: <40% BUY signals',
      'NEUTRAL: 40-60% BUY signals'
    ]
  }
];

const benefits = [
  {
    icon: '🔍',
    title: 'Comprehensive View',
    description: 'Combines price, volume, relative performance, and trading signals'
  },
  {
    icon: '📏',
    title: 'Objective Metrics',
    description: 'Uses clear numerical thresholds rather than subjective analysis'
  },
  {
    icon: '🛡️',
    title: 'Risk Management',
    description: 'More conservative in uncertain markets'
  },
  {
    icon: '🔄',
    title: 'Adaptability',
    description: 'Adjusts portfolio exposure based on market conditions'
  },
  {
    icon: '✅',
    title: 'Reliability',
    description: 'Multiple indicators reduce false signals'
  }
];

const applications = [
  {
    icon: '📊',
    title: 'Portfolio Allocation',
    description: 'Sets target percentages for tokens, SOL, and stablecoins'
  },
  {
    icon: '⚖️',
    title: 'Position Sizing',
    description: 'Determines how much capital to deploy per trade'
  },
  {
    icon: '🛡️',
    title: 'Risk Parameters',
    description: 'Adjusts stop-loss levels and profit targets'
  },
  {
    icon: '⚡',
    title: 'Execution Approach',
    description: 'Sets aggressiveness of entries and exits'
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

export default MarketSentimentPage;
