'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { useChat } from '@/app/context/ChatContext';
import { useOnboarding } from '@/app/context/OnboardingContext';
import { WalletAnalysisResult } from '@/utils/wallet-analysis';

// Wallet Analysis Section Component
function WalletAnalysisSection({ wallet }: { wallet: string }) {
  const [analysis, setAnalysis] = useState<WalletAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchAnalysis() {
      if (!wallet) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/wallet/analysis?wallet=${wallet}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch wallet analysis');
        }
        
        const data = await response.json();
        setAnalysis(data.data);
      } catch (error) {
        console.error('Error fetching wallet analysis:', error);
        setError('Failed to analyze wallet');
      } finally {
        setLoading(false);
      }
    }
    
    fetchAnalysis();
  }, [wallet]);
  
  if (loading) {
    return (
      <div className="mt-4 p-3 bg-black/30 rounded-lg border border-gold/10">
        <h3 className="font-medium text-sm uppercase text-gray-400 mb-2">Wallet Analysis</h3>
        <div className="flex justify-center py-2">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gold"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="mt-4 p-3 bg-black/30 rounded-lg border border-gold/10">
        <h3 className="font-medium text-sm uppercase text-gray-400 mb-2">Wallet Analysis</h3>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }
  
  if (!analysis) return null;
  
  return (
    <div className="mt-4 p-3 bg-black/30 rounded-lg border border-gold/10">
      <h3 className="font-medium text-sm uppercase text-gray-400 mb-2">Wallet Analysis</h3>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-400 text-xs">Invested:</span>
          <span className="text-gray-200 text-xs">${analysis.investedAmount.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400 text-xs">Withdrawn:</span>
          <span className="text-gray-200 text-xs">${analysis.withdrawnAmount.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400 text-xs">7d Flow:</span>
          <span className={`text-xs ${analysis.investor7dFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${Math.abs(analysis.investor7dFlow).toFixed(2)} {analysis.investor7dFlow >= 0 ? 'in' : 'out'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400 text-xs">Net Result:</span>
          <span className={`text-xs ${analysis.netSwapResult >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${Math.abs(analysis.netSwapResult).toFixed(2)} {analysis.netSwapResult >= 0 ? 'profit' : 'loss'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400 text-xs">PnL:</span>
          <span className={`text-xs ${analysis.pnlPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {analysis.pnlPercentage.toFixed(2)}%
          </span>
        </div>
      </div>
      
      {analysis.recentTransactions.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs text-gray-400 mb-1">Recent Activity</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {analysis.recentTransactions.slice(0, 3).map((tx, index) => (
              <div key={index} className="text-xs border-t border-gray-800 pt-1">
                <div className="flex justify-between">
                  <span className="text-gray-300">{tx.type}</span>
                  <span className="text-gray-400">{tx.timeAgo}</span>
                </div>
                <div className="text-gray-400">
                  {tx.token} • ${tx.amountUsd.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserProfileSidebar() {
  const { publicKey } = useWallet();
  const { userData, subscription, loading: chatContextLoading } = useChat();
  const { onboardingData } = useOnboarding();
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  
  // Update subscription loading state when chat context loading changes
  useEffect(() => {
    setSubscriptionLoading(chatContextLoading);
  }, [chatContextLoading, subscription]);

  return (
    <div className="w-72 bg-black/40 border-l border-gold/20 p-4 overflow-y-auto">
      <h2 className="text-lg font-semibold text-gold mb-3 mt-4">Your Personalized Settings</h2>
      <ul className="space-y-4">
        <li>
          <h3 className="font-medium text-sm uppercase text-gray-400">Experience</h3>
          <p className="text-gray-300 capitalize">
            {userData?.experience || onboardingData.experience || 'Not specified'}
          </p>
        </li>
        <li>
          <h3 className="font-medium text-sm uppercase text-gray-400">Interests</h3>
          <p className="text-gray-300">
            {(userData?.interests && userData.interests.length > 0) || (onboardingData.interests && onboardingData.interests.length > 0)
              ? (userData?.interests || onboardingData.interests).map(interest => {
                  return interest.split('-')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                }).join(', ')
              : 'Not specified'}
          </p>
        </li>
        <li>
          <h3 className="font-medium text-sm uppercase text-gray-400">Income Source</h3>
          <p className="text-gray-300 capitalize">
            {userData?.incomeSource ? userData.incomeSource.split('-').join(' ') : 
             onboardingData.incomeSource ? onboardingData.incomeSource.split('-').join(' ') : 'Not specified'}
          </p>
        </li>
        <li>
          <h3 className="font-medium text-sm uppercase text-gray-400">Risk Tolerance</h3>
          <p className="text-gray-300 capitalize">
            {userData?.riskTolerance ? userData.riskTolerance.split('-').join(' ') : 
             onboardingData.riskTolerance ? onboardingData.riskTolerance.split('-').join(' ') : 'Not specified'}
          </p>
        </li>
      </ul>

      {/* Wallet Connection Status */}
      <div className="mt-6 p-3 bg-black/30 rounded-lg border border-gold/10">
        <h3 className="font-medium text-sm uppercase text-gray-400 mb-2">Wallet Status</h3>
        {publicKey ? (
          <div className="flex items-center text-green-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">Connected: {publicKey.toString().substring(0, 4)}...{publicKey.toString().substring(publicKey.toString().length - 4)}</span>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-2">Connect to access portfolio features</p>
            <WalletConnect />
          </div>
        )}
      </div>

      {/* Subscription Status */}
      <div className="mt-4 p-3 bg-black/30 rounded-lg border border-gold/10">
        <h3 className="font-medium text-sm uppercase text-gray-400 mb-2">Subscription</h3>
        <div className="flex items-center">
          {subscriptionLoading ? (
            // Loading indicator for subscription status - show Kong Pro by default
            <div className="flex items-center text-gold">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm">
                Kong Pro
                <span className="ml-1 animate-pulse">...</span>
              </span>
            </div>
          ) : subscription?.active ? (
            // Show Pro subscription with lightning icon and days remaining
            <div className="flex items-center text-gold">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm">
                Kong Pro {subscription?.expiresAt ? (() => {
                  // Calculate days remaining
                  const expiryDate = new Date(subscription.expiresAt);
                  const today = new Date();
                  const diffTime = expiryDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  return `(${diffDays} days left)`;
                })() : ''}
              </span>
            </div>
          ) : (
            // Show Free Tier
            <div className="flex items-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm">Free Tier</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Add the wallet analysis section if wallet is connected */}
      {publicKey && (
        <WalletAnalysisSection wallet={publicKey.toString()} />
      )}
    </div>
  );
}
