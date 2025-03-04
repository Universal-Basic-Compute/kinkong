import React from 'react';
import Link from 'next/link';

const LiquidityStrategyPage = () => {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden mb-12 border border-gold/20 shadow-lg shadow-gold/10">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/80 z-10"></div>
        <div className="absolute inset-0 bg-[url('/images/liquidity-strategy-bg.jpg')] bg-cover bg-center opacity-30"></div>
        <div className="relative z-20 py-16 px-8 sm:px-16 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 electric-title">
            Liquidity Providing Strategy
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl">
            How KinKong provides liquidity to UBC/SOL and COMPUTE/SOL pools, enhancing ecosystem support while generating yield
          </p>
        </div>
      </div>

      {/* Core Strategy */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Core Strategy
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 text-gold">Liquidity Allocation</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <div>
                    <span className="font-semibold">Total Portfolio Allocation:</span>
                    <span className="block text-sm text-gray-400">30% of total portfolio</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <div>
                    <span className="font-semibold">UBC/SOL Pool:</span>
                    <span className="block text-sm text-gray-400">15% of total portfolio (50% of LP budget)</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <div>
                    <span className="font-semibold">COMPUTE/SOL Pool:</span>
                    <span className="block text-sm text-gray-400">15% of total portfolio (50% of LP budget)</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <div>
                    <span className="font-semibold">Rebalance Frequency:</span>
                    <span className="block text-sm text-gray-400">Weekly (every Friday)</span>
                  </div>
                </li>
              </ul>
              
              <div className="mt-6 p-4 bg-black/60 rounded-lg border border-gray-800">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-sm mr-3">
                    💡
                  </div>
                  <h4 className="font-bold text-gold">Why 30% Allocation?</h4>
                </div>
                <p className="text-sm text-gray-300">
                  This allocation balances yield generation with trading capital needs, while limiting impermanent loss exposure to a manageable portion of the portfolio.
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-bold mb-4 text-gold">Pool Selection Criteria</h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold mb-2">1. Concentrated Liquidity Ranges</h4>
                  <ul className="text-gray-300 space-y-1">
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <div>
                        <span className="font-semibold">UBC/SOL:</span>
                        <span className="text-sm text-gray-400"> ±20% from current price</span>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <div>
                        <span className="font-semibold">COMPUTE/SOL:</span>
                        <span className="text-sm text-gray-400"> ±15% from current price</span>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Adjust ranges based on 30-day volatility metrics</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-bold mb-2">2. Fee Tier Selection</h4>
                  <ul className="text-gray-300 space-y-1">
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <div>
                        <span className="font-semibold">UBC/SOL:</span>
                        <span className="text-sm text-gray-400"> 2% fee tier</span>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <div>
                        <span className="font-semibold">COMPUTE/SOL:</span>
                        <span className="text-sm text-gray-400"> 2% fee tier</span>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Review fee performance monthly</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-black/60 rounded-lg border border-gray-800">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-sm mr-3">
                    📊
                  </div>
                  <h4 className="font-bold text-gold">Volatility-Based Ranges</h4>
                </div>
                <p className="text-sm text-gray-300">
                  Ranges are dynamically adjusted based on recent volatility, widening during high volatility periods and narrowing during stable periods to optimize fee capture.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Position Management */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Position Management
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {positionManagement.map((section, index) => (
            <div 
              key={index}
              className="rounded-xl border border-gold/20 bg-black/50 p-6"
            >
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-lg mr-3">
                  {section.icon}
                </div>
                <h3 className="text-xl font-bold">{section.title}</h3>
              </div>
              
              <ul className="space-y-3 text-gray-300">
                {section.points.map((point, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Management */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Risk Management
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 text-gold">Impermanent Loss Mitigation</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Total 30% of portfolio allocated to liquidity positions</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Equal 15% allocation to UBC/SOL and COMPUTE/SOL pools</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Hedging with 5% allocation to out-of-range options</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Weekly IL calculation and threshold monitoring</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Partial exit when IL exceeds 5% of position value</span>
                </li>
              </ul>
              
              <div className="mt-6 p-4 bg-black/60 rounded-lg border border-gray-800">
                <h4 className="font-bold text-gold mb-2">Impermanent Loss Calculation:</h4>
                <div className="bg-black/80 rounded-lg p-3 border border-gray-800 font-mono text-xs overflow-x-auto">
                  <pre className="text-gray-300">
{`IL = 2 * sqrt(P_ratio) / (1 + P_ratio) - 1

Where:
- P_ratio = Current price / Entry price
- IL is expressed as a percentage loss`}
                  </pre>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-bold mb-4 text-gold">Security Measures</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Smart contract audit verification before deployment</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Liquidity deployed only to official Orca/Raydium pools</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Multi-signature authorization for position adjustments</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Real-time monitoring of pool contract activity</span>
                </li>
              </ul>
              
              <div className="mt-6">
                <h3 className="text-xl font-bold mb-4 text-gold">Performance Metrics</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 rounded bg-black/60 border border-gray-800">
                    <h4 className="font-semibold text-sm mb-1">Key Performance Indicators</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>Total Fee APR (annualized)</li>
                      <li>Impermanent Loss Percentage</li>
                      <li>Net Yield (Fees - IL)</li>
                      <li>Pool Utilization Rate</li>
                    </ul>
                  </div>
                  
                  <div className="p-3 rounded bg-black/60 border border-gray-800">
                    <h4 className="font-semibold text-sm mb-1">Reporting Cadence</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>Daily fee accrual monitoring</li>
                      <li>Weekly performance review</li>
                      <li>Monthly strategy optimization</li>
                      <li>Quarterly risk assessment</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Implementation Process */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Implementation Process
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4">Technical Setup</h3>
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-gold mr-2 font-bold">1.</span>
                <span>Connect to Orca/Raydium concentrated liquidity pools via API</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2 font-bold">2.</span>
                <span>Implement automated monitoring for position status</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2 font-bold">3.</span>
                <span>Configure alerts for rebalancing triggers</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2 font-bold">4.</span>
                <span>Develop dashboard for real-time performance tracking</span>
              </li>
            </ol>
            
            <div className="mt-6 p-4 bg-black/60 rounded-lg border border-gray-800">
              <h4 className="font-bold text-gold mb-2">API Integration:</h4>
              <div className="bg-black/80 rounded-lg p-3 border border-gray-800 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-300">
{`// Example API endpoint for position management
POST https://api.orca.so/v1/whirlpools/positions
{
  "tokenMintA": "UBC_MINT_ADDRESS",
  "tokenMintB": "SOL_MINT_ADDRESS",
  "tickLowerIndex": -20000,  // -20% from current price
  "tickUpperIndex": 20000,   // +20% from current price
  "liquidityAmount": "1000000000"
}`}
                </pre>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4">Operational Workflow</h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-bold text-gold mb-2">1. Analysis Phase (Thursday)</h4>
                <ul className="text-gray-300 space-y-1">
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>Review market conditions</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>Calculate optimal ranges</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>Determine allocation adjustments</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-bold text-gold mb-2">2. Execution Phase (Friday)</h4>
                <ul className="text-gray-300 space-y-1">
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>Close underperforming positions</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>Open new positions with updated ranges</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>Rebalance existing positions as needed</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-bold text-gold mb-2">3. Monitoring Phase (Continuous)</h4>
                <ul className="text-gray-300 space-y-1">
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>Track fee generation hourly</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>Monitor price movements</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>Calculate impermanent loss</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>Check pool utilization metrics</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expected Outcomes */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Expected Outcomes
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4 text-gold">Target Metrics</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {targetMetrics.map((metric, index) => (
                <div 
                  key={index}
                  className="p-4 rounded bg-black/60 border border-gray-800 flex items-center"
                >
                  <div className="w-10 h-10 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-lg mr-3">
                    {metric.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold">{metric.title}</h4>
                    <p className="text-sm text-gray-400">{metric.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4 text-gold">Strategic Benefits</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Enhanced token utility and ecosystem support</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Reduced slippage for KinKong trading operations</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Additional revenue stream independent of market direction</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Deeper market integration and protocol support</span>
              </li>
            </ul>
            
            <div className="mt-6 p-4 bg-black/60 rounded-lg border border-gray-800">
              <h4 className="font-bold text-gold mb-2">Integration with Trading Strategy:</h4>
              <p className="text-sm text-gray-300">
                Liquidity positions complement trading strategy by providing additional yield during sideways markets, reducing overall portfolio volatility, supporting ecosystem liquidity, and generating consistent fee income.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Monitoring and Optimization */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Monitoring and Optimization
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4 text-gold">Continuous Improvement</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Monthly review of range optimization strategies</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Testing of alternative liquidity deployment methods</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Comparison with single-sided staking returns</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Analysis of fee tier performance</span>
              </li>
            </ul>
          </div>
          
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4 text-gold">Risk Adjustments</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Reduce allocation during extreme market volatility</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Widen ranges during uncertain market conditions</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Implement dynamic fee tier selection based on volume</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Adjust position sizes based on historical IL metrics</span>
              </li>
            </ul>
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
const positionManagement = [
  {
    icon: '🚀',
    title: 'Entry Strategy',
    points: [
      'Staggered entry across 3 days to average price exposure',
      'Initial positions at 50% of target allocation',
      'Remaining 50% deployed after 7-day performance evaluation'
    ]
  },
  {
    icon: '⚖️',
    title: 'Rebalancing Rules',
    points: [
      'Rebalance when price moves outside 50% of defined range',
      'Rebalance when impermanent loss exceeds 2% of position value',
      'Mandatory weekly evaluation (Fridays at 16:00 UTC)',
      'Emergency rebalance during extreme volatility (>30% daily move)'
    ]
  },
  {
    icon: '🚪',
    title: 'Exit Conditions',
    points: [
      'Significant fundamental changes to either token',
      'Liquidity utilization falls below 30% for 7 consecutive days',
      'Better yield opportunities identified (>25% higher APR)',
      'Emergency protocol activation'
    ]
  }
];

const targetMetrics = [
  {
    icon: '💰',
    title: 'Fee Generation',
    value: '15-25% APR'
  },
  {
    icon: '📉',
    title: 'Impermanent Loss',
    value: '<10% annually'
  },
  {
    icon: '📈',
    title: 'Net Yield',
    value: '10-15% APR'
  },
  {
    icon: '🔄',
    title: 'Utilization Rate',
    value: '>70% average'
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
    icon: '🔄',
    title: 'Token Maximizer',
    description: 'Score-based token allocation system',
    href: '/learn/token-maximizer'
  },
  {
    icon: '⚙️',
    title: 'Technical Flows',
    description: 'Behind the scenes of KinKong\'s operations',
    href: '/learn/technical-flows'
  }
];

export default LiquidityStrategyPage;
