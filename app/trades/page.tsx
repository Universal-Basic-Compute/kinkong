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

        {/* Trade Charts */}
        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gold">Trade Visualizations</h2>
            <button 
              onClick={async () => {
                try {
                  const response = await fetch('/api/cron/generate-trade-charts', {
                    headers: {
                      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET_KEY || 'public-dev-key'}`
                    }
                  });
                  if (!response.ok) throw new Error('Failed to generate trade charts');
                  alert('Trade chart generation triggered successfully!');
                } catch (err) {
                  console.error('Error triggering trade chart generation:', err);
                  alert('Failed to trigger trade chart generation');
                }
              }}
              className="px-4 py-2 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg text-sm transition-colors"
            >
              Generate Charts
            </button>
          </div>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            <p className="text-gray-400 mb-4">
              Visual representation of recent trades showing entry points, targets, stop losses, and actual exit points.
              Charts are automatically generated for closed signals.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* This would be replaced with actual chart components */}
              <div className="bg-black/50 p-4 rounded-lg border border-gold/10 flex flex-col items-center justify-center h-64">
                <p className="text-gray-400 text-center">
                  Trade charts are generated on demand and stored in /public/charts/trades/
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Use the "Generate Charts" button to create visualizations for recent trades
                </p>
              </div>
              <div className="bg-black/50 p-4 rounded-lg border border-gold/10 flex flex-col items-center justify-center h-64">
                <p className="text-gray-400 text-center">
                  Individual charts can be generated for any closed signal
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  API endpoint: /api/signals/chart?id=[signal_id]
                </p>
              </div>
            </div>
          </div>
        </section>

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
