'use client';

import { useState, useEffect } from 'react';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { useWallet } from '@solana/wallet-adapter-react';

interface WhaleMetaAnalysisProps {
  token: string;
  timeframe: string;
  isLoading: boolean;
}

export function WhaleMetaAnalysis({ token, timeframe, isLoading }: WhaleMetaAnalysisProps) {
  const [metaAnalysis, setMetaAnalysis] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { publicKey } = useWallet();

  useEffect(() => {
    async function fetchMetaAnalysis() {
      try {
        setIsLoadingAnalysis(true);
        setError(null);
        
        const response = await fetch(`/api/whales/meta-analysis?token=${token}&timeframe=${timeframe}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setMetaAnalysis(data);
        } else {
          // If 404, it means no analysis exists yet - this is not an error
          if (response.status === 404) {
            setMetaAnalysis(null);
          } else {
            const errorData = await response.json();
            setError(errorData.error || 'Failed to fetch analysis');
          }
        }
      } catch (error) {
        console.error('Error fetching meta-analysis:', error);
        setError('Failed to load analysis');
      } finally {
        setIsLoadingAnalysis(false);
      }
    }

    if (!isLoading) {
      fetchMetaAnalysis();
    }
  }, [token, timeframe, isLoading]);

  const generateAnalysis = async () => {
    if (!publicKey) {
      alert('Please connect your wallet to generate analysis');
      return;
    }
    
    try {
      setIsGenerating(true);
      setError(null);
      
      const response = await fetch('/api/whales/generate-meta-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          timeframe,
          wallet: publicKey.toString()
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate analysis');
      }
      
      const data = await response.json();
      setMetaAnalysis(data);
    } catch (error) {
      console.error('Error generating analysis:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate analysis');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading || isLoadingAnalysis) {
    return (
      <div className="bg-black/30 p-6 rounded-lg border border-gold/20 animate-pulse mb-8">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          <div className="h-4 bg-gray-700/50 rounded w-full"></div>
          <div className="h-4 bg-gray-700/50 rounded w-5/6"></div>
          <div className="h-4 bg-gray-700/50 rounded w-4/6"></div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="h-20 bg-gray-700/30 rounded"></div>
          <div className="h-20 bg-gray-700/30 rounded"></div>
        </div>
      </div>
    );
  }

  if (!metaAnalysis) {
    return (
      <div className="bg-black/30 p-6 rounded-lg border border-gold/20 mb-8">
        <div className="text-center py-8">
          <h3 className="text-xl font-bold mb-4">No Whale Meta-Analysis Available</h3>
          <p className="text-gray-400 mb-6">
            There is no meta-analysis available for {token !== 'ALL' ? `$${token}` : 'all tokens'} in the {timeframe} timeframe.
          </p>
          <button
            onClick={generateAnalysis}
            disabled={isGenerating}
            className="px-4 py-2 bg-gold/20 hover:bg-gold/30 border border-gold rounded-lg text-white font-medium transition-colors duration-200 flex items-center justify-center mx-auto"
          >
            {isGenerating ? (
              <>
                <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                Generating Analysis...
              </>
            ) : (
              'Generate Analysis'
            )}
          </button>
          {error && (
            <p className="mt-4 text-red-400 text-sm">{error}</p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-black/30 p-6 rounded-lg border border-gold/20 mb-8">
        <h3 className="text-xl font-bold mb-4">Whale Meta-Analysis</h3>
        <p className="text-red-400">
          {error}
        </p>
      </div>
    );
  }

  // Get sentiment color and icon
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'BULLISH': return 'text-green-500';
      case 'BEARISH': return 'text-red-500';
      default: return 'text-blue-500';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'BULLISH': return <ArrowUpIcon className="h-5 w-5 text-green-500" />;
      case 'BEARISH': return <ArrowDownIcon className="h-5 w-5 text-red-500" />;
      default: return <MinusIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  // Get risk assessment color
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'HIGH': return 'text-red-500';
      case 'MEDIUM': return 'text-yellow-500';
      case 'LOW': return 'text-green-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-black/30 p-6 rounded-lg border border-gold/20 mb-8">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold">
          Whale Meta-Analysis
          {token !== 'ALL' && <span className="ml-2 metallic-text-ubc">${token}</span>}
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">
            {new Date(metaAnalysis.createdAt).toLocaleDateString()} 
            {new Date(metaAnalysis.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={generateAnalysis}
            disabled={isGenerating}
            className="p-1 text-gray-400 hover:text-gold"
            title="Refresh Analysis"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Summary and Sentiment */}
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <div className="mr-2">
            {getSentimentIcon(metaAnalysis.sentiment)}
          </div>
          <h4 className={`text-lg font-bold ${getSentimentColor(metaAnalysis.sentiment)}`}>
            {metaAnalysis.sentiment} Outlook
          </h4>
          <div className="ml-auto bg-black/30 px-3 py-1 rounded-full text-sm">
            Confidence: {metaAnalysis.confidenceScore}/100
          </div>
        </div>
        <p className="text-gray-300">{metaAnalysis.summary}</p>
      </div>
      
      {/* Price Outlook */}
      <div className="mb-6 bg-black/20 p-4 rounded-lg border border-gray-800">
        <h4 className="font-bold text-gold mb-2">Price Outlook</h4>
        <p className="text-gray-300">{metaAnalysis.priceOutlook}</p>
      </div>
      
      {/* Key Patterns and Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h4 className="font-bold text-gold mb-2">Key Patterns</h4>
          <ul className="list-disc pl-5 space-y-1 text-gray-300">
            {metaAnalysis.keyPatterns?.split('\n').map((pattern: string, index: number) => (
              <li key={index}>{pattern}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gold mb-2">Actionable Insights</h4>
          <ul className="list-disc pl-5 space-y-1 text-gray-300">
            {metaAnalysis.actionableInsights?.split('\n').map((insight: string, index: number) => (
              <li key={index}>{insight}</li>
            ))}
          </ul>
        </div>
      </div>
      
      {/* Risk Assessment */}
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <h4 className="font-bold text-gold">Risk Assessment:</h4>
          <span className={`ml-2 font-bold ${getRiskColor(metaAnalysis.riskAssessment)}`}>
            {metaAnalysis.riskAssessment}
          </span>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-gray-300">
          {metaAnalysis.riskFactors?.split('\n').map((factor: string, index: number) => (
            <li key={index}>{factor}</li>
          ))}
        </ul>
      </div>
      
      {/* Detailed Analysis */}
      <div className="mb-6">
        <h4 className="font-bold text-gold mb-2">Detailed Analysis</h4>
        <p className="text-gray-300 whitespace-pre-line">{metaAnalysis.detailedAnalysis}</p>
      </div>
      
      {/* Recommended Strategy */}
      <div className="bg-gradient-to-r from-gold/20 to-black/0 p-4 rounded-lg">
        <h4 className="font-bold text-gold mb-2">Recommended Strategy</h4>
        <div className="flex items-center">
          <div className={`text-lg font-bold ${
            metaAnalysis.recommendedStrategy === 'ACCUMULATE' ? 'text-green-500' :
            metaAnalysis.recommendedStrategy === 'REDUCE' ? 'text-red-500' :
            'text-blue-500'
          }`}>
            {metaAnalysis.recommendedStrategy}
          </div>
          <div className="ml-auto text-xs text-gray-400">
            Based on analysis of {metaAnalysis.totalWhales} whale wallets
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-700 pt-4 mt-6">
        <h4 className="font-bold text-gold mb-2">Analysis Metrics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400">Total Whales</p>
            <p className="text-lg font-bold">{metaAnalysis.totalWhales}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Bullish</p>
            <p className="text-lg font-bold text-green-500">{metaAnalysis.bullishPercentage}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Bearish</p>
            <p className="text-lg font-bold text-red-500">{metaAnalysis.bearishPercentage}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Neutral</p>
            <p className="text-lg font-bold text-blue-500">{metaAnalysis.neutralPercentage}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Accumulating</p>
            <p className="text-lg font-bold text-green-500">{metaAnalysis.accumulationPercentage}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Distributing</p>
            <p className="text-lg font-bold text-red-500">{metaAnalysis.distributionPercentage}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Holding</p>
            <p className="text-lg font-bold text-blue-500">{metaAnalysis.holdingPercentage}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">High Activity</p>
            <p className="text-lg font-bold">{metaAnalysis.highActivityPercentage}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
