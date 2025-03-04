import React from 'react';
import Link from 'next/link';

const TechnicalFlowsPage = () => {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden mb-12 border border-gold/20 shadow-lg shadow-gold/10">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/80 z-10"></div>
        <div className="absolute inset-0 bg-[url('/images/technical-flows-bg.jpg')] bg-cover bg-center opacity-30"></div>
        <div className="relative z-20 py-16 px-8 sm:px-16 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 electric-title">
            Technical Flows
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl">
            Behind the scenes of KinKong's operational processes and execution cycles
          </p>
        </div>
      </div>

      {/* Timing Specifications */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            4-Hour Cycle Schedule
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <p className="text-lg text-gray-300 mb-6">
            Each cycle runs 6 times per day (every 4 hours) with the following sequence:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {cycleSteps.map((step, index) => (
              <div 
                key={index}
                className="rounded-lg border border-gold/10 bg-black/70 p-5 relative"
              >
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-black border border-gold/30 flex items-center justify-center text-gold font-bold">
                  {index + 1}
                </div>
                <h3 className="text-lg font-bold mb-3 mt-2">{step.title}</h3>
                <p className="text-sm text-gray-400 mb-3">{step.time}</p>
                <ul className="text-sm text-gray-300 space-y-1">
                  {step.tasks.map((task, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      {task}
                    </li>
                  ))}
                </ul>
                
                {index < cycleSteps.length - 1 && (
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
          
          <div className="mt-10">
            <h3 className="text-xl font-bold mb-4">Daily Execution Times (UTC)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {executionTimes.map((time, index) => (
                <div 
                  key={index}
                  className="rounded-lg border border-gold/10 bg-black/70 p-3 text-center"
                >
                  <p className="text-gray-300">{time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Process Details */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Process Details
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4">Signal Generation Steps</h3>
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-gold mr-2 font-bold">1.</span>
                <span>Get active tokens from TOKENS table</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2 font-bold">2.</span>
                <div>
                  <span>For each token:</span>
                  <ul className="ml-6 mt-2 space-y-2">
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <div>
                        <span>Generate charts for all timeframes:</span>
                        <ul className="ml-6 mt-1 space-y-1 text-sm text-gray-400">
                          <li>SCALP: 6H analysis (15m candles) - allows overlap between cycles</li>
                          <li>INTRADAY: 24H analysis (1H candles)</li>
                          <li>SWING: 7D analysis (4H candles)</li>
                        </ul>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Get Claude analysis</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Validate signal requirements</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Create PENDING signal if valid</span>
                    </li>
                  </ul>
                </div>
              </li>
            </ol>
          </div>
          
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4">Trade Execution Steps</h3>
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-gold mr-2 font-bold">1.</span>
                <div>
                  <span>Check one PENDING signal:</span>
                  <ul className="ml-6 mt-2 space-y-2">
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Get current price</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>If price at entry (±1%), execute trade</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Update to ACTIVE if successful</span>
                    </li>
                  </ul>
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2 font-bold">2.</span>
                <div>
                  <span>Check one ACTIVE trade:</span>
                  <ul className="ml-6 mt-2 space-y-2">
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Update unrealized P&L</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Check take profit</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Check stop loss</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Check expiry</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Execute exit if conditions met</span>
                    </li>
                  </ul>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Error Handling */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Error Handling
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4">Signal Generation</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Retry chart generation up to 3 times</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Skip token if analysis fails</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Continue to next token on error</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Log all failures for review</span>
              </li>
            </ul>
          </div>
          
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4">Trade Execution</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Skip to next cycle if price feed fails</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Log failed executions</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>No automatic retries (wait for next cycle)</span>
              </li>
              <li className="flex items-start">
                <span className="text-gold mr-2">•</span>
                <span>Maintain trade state on failure</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Monitoring */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Monitoring
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-bold mb-4">Key Metrics</h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-gold mb-2">1. Signal Generation</h4>
                  <ul className="text-gray-300 space-y-1">
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Number of signals generated per cycle</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Analysis success rate</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Claude API response time</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Chart generation success rate</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-bold text-gold mb-2">2. Trade Execution</h4>
                  <ul className="text-gray-300 space-y-1">
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Execution success rate</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Price feed reliability</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Time between signal and execution</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>P&L update success rate</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-bold mb-4">Logging</h3>
              <ul className="text-gray-300 space-y-3">
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>All status changes logged with timestamps</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Execution attempts logged</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Price checks logged</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gold mr-2">•</span>
                  <span>Error conditions logged with context</span>
                </li>
              </ul>
              
              <div className="mt-6 p-4 bg-black/60 rounded-lg border border-gray-800">
                <h4 className="font-bold text-gold mb-2">Sample Log Entry:</h4>
                <div className="bg-black/80 rounded-lg p-3 border border-gray-800 font-mono text-xs overflow-x-auto">
                  <pre className="text-gray-300">
{`[2023-07-15T12:15:32.456Z] [TRADE_EXECUTION] [INFO] 
Signal ID: sig_a1b2c3d4
Token: UBC
Action: BUY
Status: EXECUTED
Entry Price: 0.9875
Amount: 105.32
Transaction: tx_e5f6g7h8i9j0`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Database Schema */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Database Schema
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4">1. SIGNALS Table</h3>
            <div className="bg-black/80 rounded-lg p-4 border border-gray-800 font-mono text-sm overflow-x-auto">
              <pre className="text-gray-300">
{`- id: string
- timestamp: datetime
- token: string
- type: BUY/SELL
- timeframe: string
- entryPrice: number
- targetPrice: number
- stopLoss: number
- status: string
- confidence: LOW/MEDIUM/HIGH
- reason: string
- expiryDate: datetime
- lastUpdateTime: datetime`}
              </pre>
            </div>
          </div>
          
          <div className="rounded-xl border border-gold/20 bg-black/50 p-6">
            <h3 className="text-xl font-bold mb-4">2. TRADES Table</h3>
            <div className="bg-black/80 rounded-lg p-4 border border-gray-800 font-mono text-sm overflow-x-auto">
              <pre className="text-gray-300">
{`- signalId: string
- timestamp: datetime
- token: string
- type: BUY/SELL
- amount: number
- price: number
- value: number
- signature: string
- executionPrice: number
- executionTimestamp: datetime
- transactionSignature: string
- unrealizedPnl: number
- realizedPnl: number
- roi: number`}
              </pre>
            </div>
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
const cycleSteps = [
  {
    title: 'Token Data',
    time: 'XX:00',
    tasks: [
      'Updates token list and metadata',
      'Validates active tokens',
      'Updates token metrics'
    ]
  },
  {
    title: 'Token Snapshots',
    time: 'XX:05',
    tasks: [
      'Records current token metrics',
      'Updates price and volume data',
      'Calculates market indicators'
    ]
  },
  {
    title: 'Signal Generation',
    time: 'XX:10',
    tasks: [
      'Processes all tokens sequentially',
      'Generates charts for 3 timeframes',
      'Creates PENDING signals in Airtable'
    ]
  },
  {
    title: 'Trade Execution',
    time: 'XX:15',
    tasks: [
      'Processes PENDING signals',
      'Checks active trades',
      'Executes entries and exits',
      'Updates trade records'
    ]
  },
  {
    title: 'Wallet Snapshot',
    time: 'XX:20',
    tasks: [
      'Records portfolio state',
      'Calculates performance metrics',
      'Updates historical data'
    ]
  }
];

const executionTimes = [
  '00:00, 00:05, 00:10, 00:15, 00:20',
  '04:00, 04:05, 04:10, 04:15, 04:20',
  '08:00, 08:05, 08:10, 08:15, 08:20',
  '12:00, 12:05, 12:10, 12:15, 12:20',
  '16:00, 16:05, 16:10, 16:15, 16:20',
  '20:00, 20:05, 20:10, 20:15, 20:20'
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

export default TechnicalFlowsPage;
