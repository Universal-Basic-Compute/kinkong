'use client';
import { TradeHistory } from '@/components/tables/TradeHistory'

export default function Performance() {
  return (
    <div className="min-h-screen bg-black">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gold mb-2">Performance & Analytics</h1>
          <p className="text-gray-400">Detailed trading performance metrics and history</p>
        </div>

        {/* Key Metrics */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gold mb-4">Key Metrics</h2>
          <div className="bg-black/30 p-8 rounded-lg border border-gold/20">
            <div className="flex flex-col items-center justify-center text-center">
              <p className="text-xl text-gold mb-2">Coming Soon</p>
              <p className="text-gray-400">Performance metrics are being calculated</p>
            </div>
          </div>
        </section>

        {/* Trade History */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gold mb-4">Recent Trades</h2>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            <TradeHistory />
          </div>
        </section>
      </main>
    </div>
  );
}
