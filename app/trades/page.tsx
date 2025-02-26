'use client';
import { TradeHistory } from '@/components/tables/TradeHistory';
import { useState } from 'react';

export default function Trades() {
  const [showChartButton, setShowChartButton] = useState(true);

  return (
    <div className="min-h-screen bg-black">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gold mb-2">Trade History</h1>
          <p className="text-gray-400">Complete history of executed trades and their performance</p>
        </div>

        {/* Trade History */}
        <section>
          <h2 className="text-2xl font-bold text-gold mb-4">Trade History</h2>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            <TradeHistory showChartButton={showChartButton} />
          </div>
        </section>
      </main>
    </div>
  );
}
