'use client';
import { useState, useEffect } from 'react';
import { TokenTable } from '@/components/tables/TokenTable';

export default function TokensPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="min-h-screen p-4 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">AI Tokens</h1>

      <div className="grid grid-cols-1 gap-8">
        {/* Token Stats */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Token Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <h3>Total Tokens</h3>
              <p className="text-2xl">11</p>
            </div>
            <div className="stat-card">
              <h3>Total Volume (7d)</h3>
              <p className="text-2xl">$33M</p>
            </div>
            <div className="stat-card">
              <h3>Average Liquidity</h3>
              <p className="text-2xl">$1.3M</p>
            </div>
          </div>
        </section>

        {/* Token Table */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Token List</h2>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            <TokenTable showAllTokens={true} />
          </div>
        </section>

        {/* Token Info */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="info-card">
            <h3 className="text-xl font-bold mb-4">Selection Criteria</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Minimum daily volume: $10,000</li>
              <li>• Minimum liquidity: $30,000</li>
              <li>• Active development & community</li>
              <li>• Listed on Jupiter DEX</li>
              <li>• Verified token program</li>
            </ul>
          </div>
          <div className="info-card">
            <h3 className="text-xl font-bold mb-4">Token Updates</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Weekly token review every Friday</li>
              <li>• Performance-based reallocation</li>
              <li>• Regular liquidity checks</li>
              <li>• Community signal integration</li>
              <li>• Emergency removal protocols</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
