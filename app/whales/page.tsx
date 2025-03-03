'use client';

import { useState, useEffect } from 'react';
import { WhaleAnalysisTable } from '@/components/whales/WhaleAnalysisTable';
import { WhaleMetricsCards } from '@/components/whales/WhaleMetricsCards';
import { WhaleDistributionChart } from '@/components/whales/WhaleDistributionChart';
import { WhaleOutlookChart } from '@/components/whales/WhaleOutlookChart';
import { WhaleMetaAnalysis } from '@/components/whales/WhaleMetaAnalysis'; // Add this import
import { TokenSelector } from '@/components/whales/TokenSelector';
import { ProCheck } from '@/components/subscription/ProCheck';
import { WhaleTeaser } from '@/components/whales/WhaleTeaser';

export default function WhalesPage() {
  const [whaleData, setWhaleData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState('ALL');
  const [timeframe, setTimeframe] = useState('7d'); // '7d', '30d', '90d'

  useEffect(() => {
    async function fetchWhaleData() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/whales?token=${selectedToken}&timeframe=${timeframe}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch whale data');
        }
        
        const data = await response.json();
        setWhaleData(data);
      } catch (error) {
        console.error('Error fetching whale data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchWhaleData();
  }, [selectedToken, timeframe]);

  const handleTokenChange = (token) => {
    setSelectedToken(token);
  };

  const handleTimeframeChange = (tf) => {
    setTimeframe(tf);
  };

  // Content for Pro members
  const proContent = (
    <main className="min-h-screen p-4 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-center">Whale Analysis</h1>
      
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center">
        <div className="mb-4 sm:mb-0">
          <TokenSelector 
            selectedToken={selectedToken} 
            onTokenChange={handleTokenChange} 
          />
        </div>
        
        <div className="flex space-x-2">
          <button 
            onClick={() => handleTimeframeChange('7d')}
            className={`px-4 py-2 rounded-lg ${timeframe === '7d' ? 'bg-gold/20 border border-gold text-white' : 'bg-black/20 border border-gray-700 text-gray-400'}`}
          >
            7 Days
          </button>
          <button 
            onClick={() => handleTimeframeChange('30d')}
            className={`px-4 py-2 rounded-lg ${timeframe === '30d' ? 'bg-gold/20 border border-gold text-white' : 'bg-black/20 border border-gray-700 text-gray-400'}`}
          >
            30 Days
          </button>
          <button 
            onClick={() => handleTimeframeChange('90d')}
            className={`px-4 py-2 rounded-lg ${timeframe === '90d' ? 'bg-gold/20 border border-gold text-white' : 'bg-black/20 border border-gray-700 text-gray-400'}`}
          >
            90 Days
          </button>
        </div>
      </div>


      <WhaleMetricsCards data={whaleData} isLoading={isLoading} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <WhaleDistributionChart data={whaleData} isLoading={isLoading} />
        <WhaleOutlookChart data={whaleData} isLoading={isLoading} />
      </div>
      
      {/* WhaleMetaAnalysis moved here, after the charts */}
      <WhaleMetaAnalysis 
        token={selectedToken} 
        timeframe={timeframe} 
        isLoading={isLoading} 
      />
      
      <WhaleAnalysisTable data={whaleData} isLoading={isLoading} />
    </main>
  );

  return (
    <ProCheck fallback={<WhaleTeaser />}>
      {proContent}
    </ProCheck>
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
