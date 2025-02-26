'use client';

import { SignalHistory } from '@/components/signals/SignalHistory'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { useState, useEffect } from 'react'

interface TokenInfo {
  token: string;
  name: string;
  mint: string;
  volume7d: number;
  liquidity: number;
  volumeGrowth: number;
  pricePerformance: number;
}

function getTokenClass(token: string): string {
  if (!token) return 'metallic-text-argent'; // Default style if token is undefined
  
  const upperToken = token.toUpperCase();
  switch (upperToken) {
    case 'UBC':
      return 'metallic-text-ubc';
    case 'COMPUTE':
      return 'metallic-text-compute';
    case 'SOL':
      return 'metallic-text-sol';
    default:
      return 'metallic-text-argent';
  }
}

export default function Signals() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [isTokensLoading, setIsTokensLoading] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTokens() {
      try {
        const response = await fetch('/api/tokens');
        if (!response.ok) throw new Error('Failed to fetch tokens');
        const data = await response.json();
        setTokens(data);
      } catch (err) {
        setTokenError(err instanceof Error ? err.message : 'Failed to load tokens');
      } finally {
        setIsTokensLoading(false);
      }
    }

    fetchTokens();
  }, []);
  return (
    <main className="min-h-screen p-4 max-w-7xl mx-auto">
      <div className="space-y-8">
        {/* Header Section with Wallet Connect */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">KinKong Signals</h1>
            <p className="text-sm text-gray-400">
              Be part of KinKong's trading intelligence! Share your market insights and influence our trading decisions while earning extra profit share allocations. Together, we're smarter! 🚀
            </p>
          </div>
          <div>
            <WalletConnect />
          </div>
        </div>

        {/* Signal History Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Recent Signals</h2>
            <div className="group relative">
              <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
                i
              </div>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10">
                Displays both community and KinKong's trading signals. KinKong analyzes and incorporates community signals into its trading decisions, with influence weighted by signal quality and historical accuracy. KinKong signals are highlighted in gold.
              </div>
            </div>
          </div>
          <SignalHistory />
        </div>


        {/* Info Section - Now Last */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="bg-black/30 border border-gold/20 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gold mb-2">Technical Analysis</h3>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {`Effective technical analysis combines multiple indicators:

• Volume & liquidity trends to confirm moves
• Price action patterns (breakouts, reversals)
• Key support/resistance levels
• Momentum indicators (RSI, MACD)
• Multiple timeframe analysis (1H, 4H, 1D)
• Risk/reward ratio assessment`}
            </p>
          </div>

          <div className="bg-black/30 border border-gold/20 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gold mb-2">Fundamental Analysis</h3>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {`Key fundamental factors to consider:

• Development activity & GitHub metrics
• Team updates & partnerships
• Community growth & engagement
• Token utility & tokenomics
• Market positioning vs competitors
• Upcoming catalysts & roadmap`}
            </p>
          </div>

          <div className="bg-black/30 border border-gold/20 rounded-lg p-4 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gold mb-2">Using Signals</h3>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                {`• Check signal source credibility
• Verify analysis with your research
• Monitor signal updates & changes
• Consider position sizing
• Set clear entry/exit points
• Use stop losses for risk management`}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gold mb-2">Creating Quality Signals</h3>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                {`• Provide clear token token & direction
• Include specific entry/exit prices
• Back analysis with multiple indicators
• Add reference links & charts
• Update signal as conditions change
• Consider market correlation`}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Notice */}
        <div className="bg-darkred/10 border border-gold/20 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {`High-quality signals that lead to profitable trades increase your profit share allocation.

Focus on AI tokens with strong fundamentals and back your analysis with on-chain data.

Regular updates to your active signals help maintain signal quality and improve community trading success.`}
            </p>
            <button 
              onClick={async () => {
                try {
                  const response = await fetch('/api/cron/calculate-signals-py', {
                    headers: {
                      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET_KEY || 'public-dev-key'}`
                    }
                  });
                  if (!response.ok) throw new Error('Failed to calculate signals');
                  alert('Signal calculation triggered successfully!');
                } catch (err) {
                  console.error('Error triggering signal calculation:', err);
                  alert('Failed to trigger signal calculation');
                }
              }}
              className="px-4 py-2 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg text-sm transition-colors"
            >
              Calculate Signals
            </button>
          </div>
        </div>
      </div>

      <section className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-bold">Tracked Tokens</h2>
          <div className="group relative">
            <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
              i
            </div>
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10">
              List of all AI tokens currently tracked by KinKong for potential trading opportunities.
            </div>
          </div>
        </div>
        
        <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
          {isTokensLoading ? (
            <div className="text-center py-4">Loading tokens...</div>
          ) : tokenError ? (
            <div className="text-center py-4 text-red-400">Error: {tokenError}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gold/20">
                    <th className="px-4 py-2 text-left text-gold">Token</th>
                    <th className="px-4 py-2 text-left text-gold">Name</th>
                    <th className="px-4 py-2 text-right text-gold">7d Volume</th>
                    <th className="px-4 py-2 text-right text-gold">Liquidity</th>
                    <th className="px-4 py-2 text-right text-gold">Volume Growth</th>
                    <th className="px-4 py-2 text-right text-gold">Price Change</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => (
                    <tr key={token.mint} className="border-b border-gold/10 hover:bg-gold/5">
                      <td className="px-4 py-2">
                        <a 
                          href={`https://solscan.io/token/${token.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`font-medium ${getTokenClass(token.token)}`}
                        >
                          {token.token}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-gray-300">{token.name}</td>
                      <td className="px-4 py-2 text-right text-gray-300">
                        ${(token.volume7d || 0).toLocaleString(undefined, {
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-300">
                        ${(token.liquidity || 0).toLocaleString(undefined, {
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={(token.volumeGrowth || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {(token.volumeGrowth || 0).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={(token.pricePerformance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {(token.pricePerformance || 0).toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
