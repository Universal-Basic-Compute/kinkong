'use client';
import { TradeHistory } from '@/components/tables/TradeHistory';
import { useState, useEffect } from 'react';
import Image from 'next/image';

// Trade chart carousel component
const TradeChartCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [charts, setCharts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCharts() {
      try {
        const response = await fetch('/api/charts/trades');
        if (!response.ok) throw new Error('Failed to fetch charts');
        const data = await response.json();
        setCharts(data.charts.slice(0, 20)); // Get only the 20 most recent
      } catch (error) {
        console.error('Error fetching charts:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCharts();
  }, []);

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === charts.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? charts.length - 1 : prevIndex - 1
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (charts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No trade charts available
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-lg aspect-video relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src={`/charts/trades/${charts[currentIndex]}`}
            alt={`Trade chart ${currentIndex + 1}`}
            fill
            className="object-contain"
          />
        </div>
      </div>
      
      <div className="absolute inset-y-0 left-0 flex items-center">
        <button 
          onClick={prevSlide}
          className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full ml-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button 
          onClick={nextSlide}
          className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full mr-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      <div className="absolute bottom-4 left-0 right-0">
        <div className="flex justify-center gap-2">
          {charts.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 w-2 rounded-full ${
                index === currentIndex ? 'bg-gold' : 'bg-gray-400/50'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

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
            <div className="h-[400px]">
              <TradeChartCarousel />
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
