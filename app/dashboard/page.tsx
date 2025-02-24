'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { PortfolioSection } from '@/components/dashboard/PortfolioSection';
import { TrackedTokensSection } from '@/components/dashboard/TrackedTokensSection';
import { InvestmentCard } from '@/components/dashboard/InvestmentCard';
import { BubbleChart } from '@/components/dashboard/BubbleChart';

import { TokenInfo } from '@/types/token';

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

export default function Dashboard() {
  const { publicKey } = useWallet();
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
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-12">Holder Dashboard</h1>

      <StatsCards investmentComponent={<InvestmentCard />} />

      <PortfolioSection />

      <section className="mb-16">
        <div className="flex items-center gap-2 mb-8">
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

        {isTrackedTokensLoading ? (
          <div>Loading...</div>
        ) : trackedTokensError ? (
          <div className="text-red-400">Error: {trackedTokensError}</div>
        ) : (
          <BubbleChart tokens={trackedTokens} />
        )}

        <div className="mt-8 bg-black/30 p-8 rounded-lg border border-gold/20">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gold/20">
                  <th className="px-4 py-2 text-left text-gold">Active</th>
                  <th className="px-4 py-2 text-left text-gold">Token</th>
                  <th className="px-4 py-2 text-left text-gold">Name</th>
                  <th className="px-4 py-2 text-left text-gold">X Account</th>
                </tr>
              </thead>
              <tbody>
                {trackedTokens.map((token) => (
                  <tr key={token.mint} className="border-b border-gold/10 hover:bg-gold/5">
                    <td className="px-4 py-2">
                      {token.isActive ? (
                        <span className="text-green-500">✓</span>
                      ) : (
                        <span className="text-red-500">✗</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <a 
                        href={`https://solscan.io/token/${token.mint}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`font-medium ${getTokenClass(token.token)}`}
                      >
                        ${token.token}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-gray-300">{token.name}</td>
                    <td className="px-4 py-2 text-gray-300">
                      {token.xAccount ? (
                        <a
                          href={`https://x.com/${token.xAccount}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          @{token.xAccount}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
