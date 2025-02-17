'use client';
import { AllocationChart } from '@/components/dashboard/AllocationChart'
import { TokenTable } from '@/components/tables/TokenTable'
import { SignalHistory } from '@/components/signals/SignalHistory'
import { useWallet } from '@solana/wallet-adapter-react'
import { useState, useEffect } from 'react'

interface TokenInfo {
  symbol: string;
  name: string;
  mint: string;
  volume7d: number;
  liquidity: number;
  volumeGrowth: number;
  pricePerformance: number;
}

function getTokenClass(token: string | undefined): string {
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

function InvestmentCard() {
  const { publicKey } = useWallet();
  const [investment, setInvestment] = useState<{
    amount: number;
    date: string;
    solscanUrl: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchInvestment() {
      if (!publicKey) return;

      try {
        const response = await fetch(`/api/user-investment?wallet=${publicKey.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch investment');
        const data = await response.json();
        setInvestment(data);
      } catch (error) {
        console.error('Error fetching investment:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchInvestment();
  }, [publicKey]);

  if (isLoading) {
    return (
      <div className="stat-card">
        <h3>Your Investment</h3>
        <p className="text-2xl">Loading...</p>
      </div>
    );
  }

  if (!investment) {
    return (
      <div className="stat-card">
        <h3>Your Investment</h3>
        <p className="text-2xl">No investment found</p>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <h3>Your Investment</h3>
      <p className="text-2xl">
        {investment.amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} USDC
      </p>
      <a 
        href={investment.solscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gold hover:text-gold/80 underline mt-1 block"
      >
        View on Solscan
      </a>
    </div>
  );
}

export default function Dashboard() {
  const [trackedTokens, setTrackedTokens] = useState<TokenInfo[]>([]);
  const [isTrackedTokensLoading, setIsTrackedTokensLoading] = useState(true);
  const [trackedTokensError, setTrackedTokensError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrackedTokens() {
      try {
        const response = await fetch('/api/tokens');
        if (!response.ok) throw new Error('Failed to fetch tokens');
        const data = await response.json();
        setTrackedTokens(data);
      } catch (err) {
        setTrackedTokensError(err instanceof Error ? err.message : 'Failed to load tokens');
      } finally {
        setIsTrackedTokensLoading(false);
      }
    }

    fetchTrackedTokens();
  }, []);
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-8">Holder Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <InvestmentCard />
        <div className="stat-card">
          <h3>Signal Success Rate</h3>
          <p className="text-2xl">XX%</p>
        </div>
        <div className="stat-card">
          <h3>Pending Profits</h3>
          <p className="text-2xl">XX SOL</p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">KinKong's Current Portfolio</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <AllocationChart />
          </div>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            <TokenTable />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Recent Signals</h2>
        <SignalHistory />
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-2xl font-bold">Tracked Tokens</h2>
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
          {isTrackedTokensLoading ? (
            <div className="text-center py-4">Loading tokens...</div>
          ) : trackedTokensError ? (
            <div className="text-center py-4 text-red-400">Error: {trackedTokensError}</div>
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
                  {trackedTokens.map((token) => (
                    <tr key={token.mint} className="border-b border-gold/10 hover:bg-gold/5">
                      <td className="px-4 py-2">
                        <a 
                          href={`https://solscan.io/token/${token.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`font-medium ${getTokenClass(token.symbol)}`}
                        >
                          ${token.symbol}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-gray-300">{token.name}</td>
                      <td className="px-4 py-2 text-right text-gray-300">
                        ${token.volume7d.toLocaleString(undefined, {
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-300">
                        ${token.liquidity.toLocaleString(undefined, {
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={token.volumeGrowth >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {token.volumeGrowth.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={token.pricePerformance >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {token.pricePerformance.toFixed(2)}%
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

      <section className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-2xl font-bold">Tracked Tokens</h2>
          <div className="group relative">
            <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
              i
            </div>
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10">
              List of all AI tokens currently tracked by KinKong for potential trading opportunities.
            </div>
          </div>
        </div>
        
        <div className="mb-8">
          <div className="flex flex-wrap gap-4 justify-center">
            {tokens.map((token) => (
              <div 
                key={token.mint}
                className="relative group"
              >
                <div 
                  className={`
                    w-24 h-24 rounded-full flex items-center justify-center
                    transition-all duration-300 cursor-pointer
                    ${token.pricePerformance >= 0 ? 'bg-green-900/20' : 'bg-red-900/20'}
                    hover:scale-110
                  `}
                  style={{
                    boxShadow: `0 0 20px ${token.pricePerformance >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                    transform: `scale(${Math.min(1 + Math.abs(token.volumeGrowth) / 1000, 1.5)})`
                  }}
                >
                  <div className="text-center">
                    <div className={`text-lg font-bold ${getTokenClass(token.symbol)}`}>
                      ${token.symbol}
                    </div>
                    <div className={`text-sm ${token.pricePerformance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {token.pricePerformance.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
                  <div className="bg-black/90 border border-gold/20 rounded-lg p-3 whitespace-nowrap text-sm">
                    <div className="text-gray-300">Volume: ${token.volume7d.toLocaleString()}</div>
                    <div className="text-gray-300">Liquidity: ${token.liquidity.toLocaleString()}</div>
                    <div className={token.volumeGrowth >= 0 ? 'text-green-400' : 'text-red-400'}>
                      Volume Growth: {token.volumeGrowth.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
                          className={`font-medium ${getTokenClass(token.symbol)}`}
                        >
                          {token.symbol}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-gray-300">{token.name}</td>
                      <td className="px-4 py-2 text-right text-gray-300">
                        ${token.volume7d.toLocaleString(undefined, {
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-300">
                        ${token.liquidity.toLocaleString(undefined, {
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={token.volumeGrowth >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {token.volumeGrowth.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={token.pricePerformance >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {token.pricePerformance.toFixed(2)}%
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
