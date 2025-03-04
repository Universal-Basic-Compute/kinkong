import React from 'react';
import Link from 'next/link';

const TradeSizingPage = () => {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden mb-12 border border-gold/20 shadow-lg shadow-gold/10">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/80 z-10"></div>
        <div className="absolute inset-0 bg-[url('/images/trade-sizing-bg.jpg')] bg-cover bg-center opacity-30"></div>
        <div className="relative z-20 py-16 px-8 sm:px-16 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 electric-title">
            Dynamic Trade Sizing
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl">
            How KinKong determines the optimal position size for each trade based on market conditions
          </p>
        </div>
      </div>

      {/* Core Concept Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            The Core Concept
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <p className="text-lg text-gray-300 mb-6">
            KinKong uses a dynamic trade sizing approach that automatically adapts to current market conditions, balancing opportunity with risk management.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-lg border border-gold/10 bg-black/70 p-6">
              <h3 className="text-xl font-bold mb-3 text-gold">Key Factors Considered</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <div>
                    <span className="font-semibold">Market Sentiment:</span>
                    <span className="block text-sm text-gray-400">BULLISH/NEUTRAL/BEARISH classification</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <div>
                    <span className="font-semibold">Available USDC Balance:</span>
                    <span className="block text-sm text-gray-400">Current liquid capital for trading</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <div>
                    <span className="font-semibold">Target Portfolio Allocations:</span>
                    <span className="block text-sm text-gray-400">Desired exposure to different asset classes</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <div>
                    <span className="font-semibold">Risk Management Limits:</span>
                    <span className="block text-sm text-gray-400">Maximum exposure per trade and token</span>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="rounded-lg border border-gold/10 bg-black/70 p-6">
              <h3 className="text-xl font-bold mb-3 text-gold">Market-Driven Allocations</h3>
              <p className="text-gray-300 mb-3">We maintain three different target allocations based on market sentiment:</p>
              
              <div className="space-y-3">
                <div className="p-3 rounded bg-green-950/30 border border-green-800/30">
                  <p className="font-semibold text-green-400">BULLISH Market:</p>
                  <ul className="text-gray-300 text-sm">
                    <li>AI Tokens: 70%</li>
                    <li>SOL: 20%</li>
                    <li>Stables: 10%</li>
                  </ul>
                </div>
                
                <div className="p-3 rounded bg-blue-950/30 border border-blue-800/30">
                  <p className="font-semibold text-blue-400">NEUTRAL Market:</p>
                  <ul className="text-gray-300 text-sm">
                    <li>AI Tokens: 50%</li>
                    <li>SOL: 20%</li>
                    <li>Stables: 30%</li>
                  </ul>
                </div>
                
                <div className="p-3 rounded bg-red-950/30 border border-red-800/30">
                  <p className="font-semibold text-red-400">BEARISH Market:</p>
                  <ul className="text-gray-300 text-sm">
                    <li>AI Tokens: 30%</li>
                    <li>SOL: 10%</li>
                    <li>Stables: 60%</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calculation Process */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Trade Size Calculation
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <p className="text-lg text-gray-300 mb-6">
            For each trade, KinKong follows a systematic process to determine the optimal position size:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {calculationSteps.map((step, index) => (
              <div 
                key={index}
                className="rounded-lg border border-gold/10 bg-black/70 p-5 relative"
              >
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-black border border-gold/30 flex items-center justify-center text-gold font-bold">
                  {index + 1}
                </div>
                <h3 className="text-lg font-bold mb-3 mt-2">{step.title}</h3>
                <p className="text-sm text-gray-400">{step.description}</p>
                
                {index < calculationSteps.length - 1 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 transform -translate-y-1/2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 12H19" stroke="#FFD700" strokeOpacity="0.3" strokeWidth="2" />
                      <path d="M14 6L20 12L14 18" stroke="#FFD700" strokeOpacity="0.3" strokeWidth="2" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-10 p-6 bg-black/70 border border-gold/10 rounded-lg">
            <h3 className="text-xl font-bold mb-4">Example Calculation:</h3>
            <div className="bg-black/80 rounded-lg p-4 border border-gray-800 font-mono text-sm overflow-x-auto">
              <pre className="text-gray-300">
{`Available USDC: $1000
Market Sentiment: BULLISH (70% allocation)

Trade Value = $1000 * 0.10 * 0.70
           = $70 per trade`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Limits */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Safety Limits
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <p className="text-lg text-gray-300 mb-6">
            To ensure responsible trading and protect capital, KinKong implements several safety limits:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {safetyLimits.map((limit, index) => (
              <div 
                key={index}
                className="rounded-lg border border-gold/10 bg-black/70 p-6 flex flex-col items-center text-center"
              >
                <div className="text-3xl mb-3">{limit.icon}</div>
                <h3 className="text-lg font-bold mb-2">{limit.title}</h3>
                <p className="text-sm text-gray-400">{limit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Code Example */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Real Code Example
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <p className="text-lg text-gray-300 mb-6">
            Here's a simplified version of the actual code KinKong uses to calculate trade sizes:
          </p>
          
          <div className="bg-black/80 rounded-lg p-6 border border-gray-800 font-mono text-sm overflow-x-auto">
            <pre className="text-gray-300">
{`async def execute_trade(signal):
    # 1. Get market sentiment
    sentiment = await get_current_market_sentiment()
    
    # 2. Get allocation percentage
    allocation_pct = {
        "BULLISH": 0.70,
        "NEUTRAL": 0.50,
        "BEARISH": 0.30
    }.get(sentiment, 0.50)
    
    # 3. Calculate trade value
    usdc_balance = await get_usdc_balance()
    trade_value = min(
        usdc_balance * 0.10 * allocation_pct,  # 10% of USDC * allocation
        1000  # Max cap
    )
    trade_value = max(trade_value, 10)  # Min $10`}
            </pre>
          </div>
        </div>
      </div>

      {/* Example Scenarios */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Example Scenarios
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {scenarios.map((scenario, index) => (
            <div 
              key={index}
              className={`rounded-xl border ${scenario.borderClass} ${scenario.bgClass} p-6`}
            >
              <h3 className={`text-xl font-bold mb-4 ${scenario.textClass}`}>{scenario.title}</h3>
              <div className="space-y-3">
                <div className="bg-black/60 rounded-lg p-4 border border-gray-800">
                  <p className="text-gray-300 mb-2">
                    <span className="font-semibold">USDC Balance:</span> $10,000
                  </p>
                  <p className="text-gray-300 mb-2">
                    <span className="font-semibold">Allocation:</span> {scenario.allocation}
                  </p>
                  <div className="font-mono text-sm mt-4">
                    <p className="text-gray-300">Trade Size = $10,000 * 0.10 * {scenario.allocationDecimal}</p>
                    <p className={`text-lg font-bold ${scenario.textClass} mt-2`}>= ${scenario.result}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Benefits Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Why This Approach?
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {benefits.map((benefit, index) => (
              <div 
                key={index}
                className="flex items-start"
              >
                <div className="w-12 h-12 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-xl mr-4 flex-shrink-0">
                  {benefit.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2">{benefit.title}</h3>
                  <p className="text-gray-400">{benefit.description}</p>
                </div>
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
const calculationSteps = [
  {
    title: 'Get Market Sentiment',
    description: 'Determine if the current market is BULLISH, NEUTRAL, or BEARISH'
  },
  {
    title: 'Determine Allocation %',
    description: 'Apply the sentiment-based allocation percentage (70%, 50%, or 30%)'
  },
  {
    title: 'Calculate Base Size',
    description: 'Use 10% of available USDC balance as the base trade size'
  },
  {
    title: 'Apply Final Formula',
    description: 'Multiply base size by allocation percentage, apply min/max limits'
  }
];

const safetyLimits = [
  {
    icon: '⬇️',
    title: 'Minimum Trade Size',
    description: '$10 minimum to ensure trades are meaningful while avoiding dust amounts'
  },
  {
    icon: '⬆️',
    title: 'Maximum Trade Size',
    description: '$1,000 maximum per trade to limit exposure to any single position'
  },
  {
    icon: '💧',
    title: 'Liquidity Requirement',
    description: 'Token must have at least 3x the trade size in liquidity to ensure smooth execution'
  }
];

const scenarios = [
  {
    title: 'Bullish Market',
    allocation: '70%',
    allocationDecimal: '0.70',
    result: '700',
    borderClass: 'border-green-800/30',
    bgClass: 'bg-green-950/20',
    textClass: 'text-green-400'
  },
  {
    title: 'Neutral Market',
    allocation: '50%',
    allocationDecimal: '0.50',
    result: '500',
    borderClass: 'border-blue-800/30',
    bgClass: 'bg-blue-950/20',
    textClass: 'text-blue-400'
  },
  {
    title: 'Bearish Market',
    allocation: '30%',
    allocationDecimal: '0.30',
    result: '300',
    borderClass: 'border-red-800/30',
    bgClass: 'bg-red-950/20',
    textClass: 'text-red-400'
  }
];

const benefits = [
  {
    icon: '⚖️',
    title: 'Natural Portfolio Balance',
    description: 'Trade sizes automatically adjust to help reach target allocations based on market conditions'
  },
  {
    icon: '🛡️',
    title: 'Risk Management',
    description: 'Smaller trades in bearish markets, larger trades in bullish markets, never risking more than 10% of USDC per trade'
  },
  {
    icon: '🔄',
    title: 'Market Adaptation',
    description: 'Automatically becomes more conservative in bearish markets and takes advantage of bullish conditions'
  },
  {
    icon: '📈',
    title: 'Sustainability',
    description: 'Preserves capital in tough markets, scales position sizes with portfolio growth, and prevents overexposure to any single trade'
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
    icon: '🔍',
    title: 'Token Discovery',
    description: 'How KinKong finds promising tokens',
    href: '/learn/token-discovery'
  }
];

export default TradeSizingPage;
