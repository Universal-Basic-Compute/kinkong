import React from 'react';
import Link from 'next/link';

const TokenMaximizerPage = () => {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden mb-12 border border-gold/20 shadow-lg shadow-gold/10">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/80 z-10"></div>
        <div className="absolute inset-0 bg-[url('/images/token-maximizer-bg.jpg')] bg-cover bg-center opacity-30"></div>
        <div className="relative z-20 py-16 px-8 sm:px-16 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 electric-title">
            Token Maximizer Strategy
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl">
            Score-based token-native strategy for daily UBC/COMPUTE/SOL allocation
          </p>
        </div>
      </div>

      {/* Core Concept */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Core Concept: 1 UBC = 1 UBC
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <p className="text-lg text-gray-300 mb-6">
            This strategy measures success by token quantity growth, not dollar value:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-lg border border-gold/10 bg-black/70 p-6 flex flex-col items-center text-center">
              <div className="text-4xl mb-4">🪙</div>
              <h3 className="text-lg font-bold mb-2">Token-Native Measurement</h3>
              <p className="text-sm text-gray-400">Performance measured in actual token amounts, not dollar value</p>
            </div>
            
            <div className="rounded-lg border border-gold/10 bg-black/70 p-6 flex flex-col items-center text-center">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-lg font-bold mb-2">Accumulation Focus</h3>
              <p className="text-sm text-gray-400">Focus on accumulating more tokens regardless of price fluctuations</p>
            </div>
            
            <div className="rounded-lg border border-gold/10 bg-black/70 p-6 flex flex-col items-center text-center">
              <div className="text-4xl mb-4">🔄</div>
              <h3 className="text-lg font-bold mb-2">Guaranteed Withdrawals</h3>
              <p className="text-sm text-gray-400">Ensures withdrawals are always possible in the original token</p>
            </div>
          </div>
          
          <div className="mt-8 p-5 bg-black/60 rounded-lg border border-gray-800">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-lg mr-3">
                💡
              </div>
              <h3 className="text-xl font-bold">Why Token-Native?</h3>
            </div>
            <p className="text-gray-300">
              By focusing on token quantity rather than dollar value, this strategy aligns with the fundamental belief in the long-term value of the tokens themselves. It removes the psychological impact of price volatility and creates a consistent framework for measuring success.
            </p>
          </div>
        </div>
      </div>

      {/* Investment Options */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Investment Options
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 text-gold">Direct Holdings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded bg-black/60 border border-gray-800 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center mb-2">
                    <span className="metallic-text-ubc font-bold">UBC</span>
                  </div>
                  <p className="text-center text-sm text-gray-300">UBC Token</p>
                </div>
                
                <div className="p-4 rounded bg-black/60 border border-gray-800 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center mb-2">
                    <span className="metallic-text-compute font-bold">COMPUTE</span>
                  </div>
                  <p className="text-center text-sm text-gray-300">COMPUTE Token</p>
                </div>
                
                <div className="p-4 rounded bg-black/60 border border-gray-800 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center mb-2">
                    <span className="metallic-text-sol font-bold">SOL</span>
                  </div>
                  <p className="text-center text-sm text-gray-300">SOL Token</p>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-bold mb-4 text-gold">Liquidity Pools</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded bg-black/60 border border-gray-800 flex flex-col items-center">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center mr-1">
                      <span className="metallic-text-ubc text-xs font-bold">UBC</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center ml-1">
                      <span className="metallic-text-sol text-xs font-bold">SOL</span>
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-300">UBC/SOL LP</p>
                </div>
                
                <div className="p-4 rounded bg-black/60 border border-gray-800 flex flex-col items-center">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center mr-1">
                      <span className="metallic-text-compute text-xs font-bold">COMPUTE</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center ml-1">
                      <span className="metallic-text-sol text-xs font-bold">SOL</span>
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-300">COMPUTE/SOL LP</p>
                </div>
                
                <div className="p-4 rounded bg-black/60 border border-gray-800 flex flex-col items-center">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center mr-1">
                      <span className="metallic-text-ubc text-xs font-bold">UBC</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center ml-1">
                      <span className="metallic-text-compute text-xs font-bold">COMPUTE</span>
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-300">UBC/COMPUTE LP</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scoring Process */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Daily Scoring Process
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <p className="text-lg text-gray-300 mb-6">
            Every 24 hours, score each token on a -10 to +10 scale:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-lg border border-gold/10 bg-black/70 p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center mr-4">
                  <span className="metallic-text-ubc font-bold">UBC</span>
                </div>
                <h3 className="text-xl font-bold">UBC Score (-10 to +10)</h3>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 rounded bg-green-950/30 border border-green-800/30">
                  <p className="font-semibold text-green-400">+10: Extremely bullish on UBC vs SOL</p>
                  <p className="text-sm text-gray-300">Strong conviction that UBC will outperform SOL</p>
                </div>
                
                <div className="p-3 rounded bg-blue-950/30 border border-blue-800/30">
                  <p className="font-semibold text-blue-400">0: Neutral on UBC vs SOL</p>
                  <p className="text-sm text-gray-300">Equal performance expected between UBC and SOL</p>
                </div>
                
                <div className="p-3 rounded bg-red-950/30 border border-red-800/30">
                  <p className="font-semibold text-red-400">-10: Extremely bearish on UBC vs SOL</p>
                  <p className="text-sm text-gray-300">Strong conviction that UBC will underperform SOL</p>
                </div>
              </div>
            </div>
            
            <div className="rounded-lg border border-gold/10 bg-black/70 p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center mr-4">
                  <span className="metallic-text-compute font-bold">COMPUTE</span>
                </div>
                <h3 className="text-xl font-bold">COMPUTE Score (-10 to +10)</h3>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 rounded bg-green-950/30 border border-green-800/30">
                  <p className="font-semibold text-green-400">+10: Extremely bullish on COMPUTE vs SOL</p>
                  <p className="text-sm text-gray-300">Strong conviction that COMPUTE will outperform SOL</p>
                </div>
                
                <div className="p-3 rounded bg-blue-950/30 border border-blue-800/30">
                  <p className="font-semibold text-blue-400">0: Neutral on COMPUTE vs SOL</p>
                  <p className="text-sm text-gray-300">Equal performance expected between COMPUTE and SOL</p>
                </div>
                
                <div className="p-3 rounded bg-red-950/30 border border-red-800/30">
                  <p className="font-semibold text-red-400">-10: Extremely bearish on COMPUTE vs SOL</p>
                  <p className="text-sm text-gray-300">Strong conviction that COMPUTE will underperform SOL</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Allocation Formula */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Allocation Formula
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <p className="text-lg text-gray-300 mb-6">
            The scoring system creates a dynamic allocation across all six investment options:
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {allocationFormulas.map((formula, index) => (
              <div 
                key={index}
                className="rounded-lg border border-gold/10 bg-black/70 p-5"
              >
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center mr-3">
                    {formula.icon}
                  </div>
                  <h3 className="text-lg font-bold">{formula.title}</h3>
                </div>
                
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>Base allocation: 16.67% (1/6 of portfolio)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>{formula.adjustment}</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>{formula.maximum}</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-2">•</span>
                    <span>{formula.minimum}</span>
                  </li>
                </ul>
              </div>
            ))}
          </div>
          
          <div className="mt-8">
            <h3 className="text-xl font-bold mb-4 text-center">Simplified Calculation Table</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="py-3 px-4 text-gold">Score Combination</th>
                    <th className="py-3 px-4 text-gold">UBC</th>
                    <th className="py-3 px-4 text-gold">COMPUTE</th>
                    <th className="py-3 px-4 text-gold">UBC/SOL LP</th>
                    <th className="py-3 px-4 text-gold">COMPUTE/SOL LP</th>
                    <th className="py-3 px-4 text-gold">UBC/COMPUTE LP</th>
                    <th className="py-3 px-4 text-gold">SOL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {calculationTable.map((row, index) => (
                    <tr key={index} className="hover:bg-black/40">
                      <td className="py-3 px-4 text-gray-300">{row.combination}</td>
                      <td className="py-3 px-4 text-gray-300">{row.ubc}</td>
                      <td className="py-3 px-4 text-gray-300">{row.compute}</td>
                      <td className="py-3 px-4 text-gray-300">{row.ubcSolLp}</td>
                      <td className="py-3 px-4 text-gray-300">{row.computeSolLp}</td>
                      <td className="py-3 px-4 text-gray-300">{row.ubcComputeLp}</td>
                      <td className="py-3 px-4 text-gray-300">{row.sol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Implementation Guide */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Implementation Guide
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {implementationSteps.map((step, index) => (
            <div 
              key={index}
              className="rounded-xl border border-gold/20 bg-black/50 p-6"
            >
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-lg mr-3">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold">{step.title}</h3>
              </div>
              
              <ol className="space-y-3 text-gray-300">
                {step.steps.map((substep, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-gold mr-2 font-bold">{i+1}.</span>
                    <span>{substep}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {/* Practical Examples */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Practical Examples
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {practicalExamples.map((example, index) => (
            <div 
              key={index}
              className="rounded-xl border border-gold/20 bg-black/50 p-6"
            >
              <h3 className="text-xl font-bold mb-4">{example.title}</h3>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between p-2 bg-black/60 rounded border border-gray-800">
                  <span className="text-gray-400">UBC Score:</span>
                  <span className="font-semibold">{example.ubcScore}</span>
                </div>
                <div className="flex justify-between p-2 bg-black/60 rounded border border-gray-800">
                  <span className="text-gray-400">COMPUTE Score:</span>
                  <span className="font-semibold">{example.computeScore}</span>
                </div>
              </div>
              
              <h4 className="font-semibold mb-2">Resulting Allocation:</h4>
              <div className="space-y-2">
                {example.allocation.map((item, i) => (
                  <div key={i} className="flex justify-between p-2 bg-black/40 rounded">
                    <span className="text-gray-300">{item.asset}:</span>
                    <span className="font-semibold text-gold">{item.percentage}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Tracking */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Performance Tracking
          </span>
        </h2>
        
        <div className="rounded-xl border border-gold/20 bg-black/50 p-8">
          <p className="text-lg text-gray-300 mb-6">
            Track these key metrics in token-native terms:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                <p className="text-gray-400">{metric.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Advantages */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold via-white to-gold">
            Advantages of Score-Based Allocation
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {advantages.map((advantage, index) => (
            <div 
              key={index}
              className="rounded-xl border border-gold/20 bg-black/50 p-6"
            >
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-black/70 border border-gold/30 flex items-center justify-center text-lg mr-3">
                  {advantage.icon}
                </div>
                <h3 className="text-xl font-bold">{advantage.title}</h3>
              </div>
              <p className="text-gray-300 mb-4">{advantage.description}</p>
              <ul className="space-y-2 text-sm text-gray-400">
                {advantage.points.map((point, i) => (
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
const allocationFormulas = [
  {
    icon: '🪙',
    title: 'Direct UBC Holdings',
    adjustment: 'Adjustment: +1.67% for each positive UBC score point',
    maximum: 'Maximum: 33.33% at UBC score +10',
    minimum: 'Minimum: 0% at UBC score -10'
  },
  {
    icon: '🪙',
    title: 'Direct COMPUTE Holdings',
    adjustment: 'Adjustment: +1.67% for each positive COMPUTE score point',
    maximum: 'Maximum: 33.33% at COMPUTE score +10',
    minimum: 'Minimum: 0% at COMPUTE score -10'
  },
  {
    icon: '💧',
    title: 'UBC/SOL LP',
    adjustment: 'Adjustment: +1.67% for each negative UBC score point',
    maximum: 'Maximum: 33.33% at UBC score -10',
    minimum: 'Minimum: 0% at UBC score +10'
  },
  {
    icon: '💧',
    title: 'COMPUTE/SOL LP',
    adjustment: 'Adjustment: +1.67% for each negative COMPUTE score point',
    maximum: 'Maximum: 33.33% at COMPUTE score -10',
    minimum: 'Minimum: 0% at COMPUTE score +10'
  },
  {
    icon: '💧',
    title: 'UBC/COMPUTE LP',
    adjustment: 'Adjustment: Higher when both tokens have similar scores',
    maximum: 'Maximum: 33.33% when UBC and COMPUTE scores are identical',
    minimum: 'Minimum: 0% when scores are at opposite extremes'
  },
  {
    icon: '🪙',
    title: 'Direct SOL Holdings',
    adjustment: 'Adjustment: Increases when both UBC and COMPUTE scores are negative',
    maximum: 'Maximum: 33.33% when both tokens are at -10',
    minimum: 'Minimum: 0% when either token is above 0'
  }
];

const calculationTable = [
  {
    combination: 'UBC +10, COMP +10',
    ubc: '33%',
    compute: '33%',
    ubcSolLp: '0%',
    computeSolLp: '0%',
    ubcComputeLp: '33%',
    sol: '0%'
  },
  {
    combination: 'UBC +10, COMP -10',
    ubc: '33%',
    compute: '0%',
    ubcSolLp: '0%',
    computeSolLp: '33%',
    ubcComputeLp: '0%',
    sol: '33%'
  },
  {
    combination: 'UBC -10, COMP +10',
    ubc: '0%',
    compute: '33%',
    ubcSolLp: '33%',
    computeSolLp: '0%',
    ubcComputeLp: '0%',
    sol: '33%'
  },
  {
    combination: 'UBC -10, COMP -10',
    ubc: '0%',
    compute: '0%',
    ubcSolLp: '33%',
    computeSolLp: '33%',
    ubcComputeLp: '0%',
    sol: '33%'
  },
  {
    combination: 'UBC +5, COMP +5',
    ubc: '25%',
    compute: '25%',
    ubcSolLp: '8%',
    computeSolLp: '8%',
    ubcComputeLp: '25%',
    sol: '8%'
  },
  {
    combination: 'UBC +5, COMP -5',
    ubc: '25%',
    compute: '8%',
    ubcSolLp: '8%',
    computeSolLp: '25%',
    ubcComputeLp: '15%',
    sol: '16%'
  },
  {
    combination: 'UBC 0, COMP 0',
    ubc: '17%',
    compute: '17%',
    ubcSolLp: '17%',
    computeSolLp: '17%',
    ubcComputeLp: '33%',
    sol: '0%'
  }
];

const implementationSteps = [
  {
    icon: '📊',
    title: 'Score Assignment',
    steps: [
      'Fetch market sentiment data',
      'Get token data from DexScreener API',
      'Use Claude AI to analyze data and assign scores',
      'Assign UBC score from -10 to +10',
      'Assign COMPUTE score from -10 to +10'
    ]
  },
  {
    icon: '🧮',
    title: 'Calculate Allocation',
    steps: [
      'Use the scoring table or formula to determine target allocation',
      'Round allocations to nearest 5% for simplicity',
      'Ensure allocations total 100%',
      'Document reasoning for score assignment'
    ]
  },
  {
    icon: '🔄',
    title: 'Execute Reallocation',
    steps: [
      'Compare current allocation to target allocation',
      'Adjust positions to match target allocation',
      'Minimize transaction costs by setting minimum rebalance threshold (5%)',
      'Record all transactions for performance tracking'
    ]
  }
];

const practicalExamples = [
  {
    title: 'Example 1: Bullish UBC, Bearish COMPUTE',
    ubcScore: '+8',
    computeScore: '-3',
    allocation: [
      { asset: 'Direct UBC', percentage: '30%' },
      { asset: 'Direct COMPUTE', percentage: '12%' },
      { asset: 'UBC/SOL LP', percentage: '3%' },
      { asset: 'COMPUTE/SOL LP', percentage: '22%' },
      { asset: 'UBC/COMPUTE LP', percentage: '15%' },
      { asset: 'Direct SOL', percentage: '18%' }
    ]
  },
  {
    title: 'Example 2: Both Mildly Bearish',
    ubcScore: '-4',
    computeScore: '-4',
    allocation: [
      { asset: 'Direct UBC', percentage: '10%' },
      { asset: 'Direct COMPUTE', percentage: '10%' },
      { asset: 'UBC/SOL LP', percentage: '23%' },
      { asset: 'COMPUTE/SOL LP', percentage: '23%' },
      { asset: 'UBC/COMPUTE LP', percentage: '25%' },
      { asset: 'Direct SOL', percentage: '9%' }
    ]
  },
  {
    title: 'Example 3: Neutral on Both',
    ubcScore: '0',
    computeScore: '0',
    allocation: [
      { asset: 'Direct UBC', percentage: '17%' },
      { asset: 'Direct COMPUTE', percentage: '17%' },
      { asset: 'UBC/SOL LP', percentage: '17%' },
      { asset: 'COMPUTE/SOL LP', percentage: '17%' },
      { asset: 'UBC/COMPUTE LP', percentage: '33%' },
      { asset: 'Direct SOL', percentage: '0%' }
    ]
  }
];

const performanceMetrics = [
  {
    icon: '🪙',
    title: 'Total UBC Equivalent Holdings',
    description: 'Direct UBC + UBC portion of LP positions + Converted value of other assets in UBC terms'
  },
  {
    icon: '🪙',
    title: 'Total COMPUTE Equivalent Holdings',
    description: 'Direct COMPUTE + COMPUTE portion of LP positions + Converted value of other assets in COMPUTE terms'
  },
  {
    icon: '💰',
    title: 'LP Fee Generation',
    description: 'Track fees earned from each LP position and convert to token equivalents'
  },
  {
    icon: '📊',
    title: 'Position Performance',
    description: 'Track token accumulation rate for each position and compare performance between strategies'
  }
];

const advantages = [
  {
    icon: '📏',
    title: 'Nuanced Position Sizing',
    description: 'Captures degree of conviction, not just direction',
    points: [
      'Creates smoother transitions between allocations',
      'Allows for partial position adjustments',
      'Reflects confidence level in predictions'
    ]
  },
  {
    icon: '🤖',
    title: 'Systematic Approach',
    description: 'Removes emotional decision-making',
    points: [
      'Creates consistent, repeatable process',
      'Allows for performance analysis by score',
      'Provides clear framework for allocation decisions'
    ]
  },
  {
    icon: '🔄',
    title: 'Flexible Implementation',
    description: 'Can be adjusted daily or on custom schedule',
    points: [
      'Scores can incorporate various inputs (technical, fundamental, sentiment)',
      'Formula can be tweaked based on market conditions',
      'Adaptable to changing market environments'
    ]
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
    icon: '💧',
    title: 'Liquidity Strategy',
    description: 'KinKong\'s approach to providing liquidity',
    href: '/learn/liquidity-strategy'
  },
  {
    icon: '⚙️',
    title: 'Technical Flows',
    description: 'Behind the scenes of KinKong\'s operations',
    href: '/learn/technical-flows'
  }
];

export default TokenMaximizerPage;
