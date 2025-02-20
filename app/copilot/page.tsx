'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSearchParams } from 'next/navigation';
import { verifySubscription } from '@/utils/subscription';
import { getTable } from '@/backend/src/airtable/tables';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';

// Add environment variables check
if (!process.env.NEXT_PUBLIC_HELIUS_RPC_URL || !process.env.NEXT_PUBLIC_SUBSCRIPTION_WALLET) {
  throw new Error('Missing required environment variables: NEXT_PUBLIC_HELIUS_RPC_URL and/or NEXT_PUBLIC_SUBSCRIPTION_WALLET');
}

export default function CopilotSubscriptionPage() {
  const { publicKey, signTransaction, connected } = useWallet();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'inactive' | 'loading'>('loading');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);

  const SUBSCRIPTION_COST = 1.5; // SOL
  const SUBSCRIPTION_DURATION = '3 months';

  useEffect(() => {
    checkSubscription();
  }, [code]);

  async function checkSubscription() {
    if (!code) {
      setSubscriptionStatus('inactive');
      return;
    }

    try {
      setSubscriptionStatus('loading');
      const result = await verifySubscription(code);
      setSubscriptionStatus(result.active ? 'active' : 'inactive');
    } catch (err) {
      console.error('Error checking subscription:', err);
      setSubscriptionStatus('inactive');
    }
  }

  async function handleLinkWallet() {
    if (!publicKey || !code) return;

    try {
      setIsProcessing(true);
      setError(null);
      setLinkSuccess(false);

      // First check if wallet has an active subscription
      const subscriptionsTable = getTable('SUBSCRIPTIONS');
      const existingSubscriptions = await subscriptionsTable.select({
        filterByFormula: `AND(
          {wallet}='${publicKey.toString()}',
          {status}='ACTIVE',
          {endDate}>=TODAY()
        )`
      }).firstPage();

      if (existingSubscriptions.length === 0) {
        setError('No active subscription found for this wallet');
        return;
      }

      // Update the subscription with the new code
      const subscription = existingSubscriptions[0];
      await subscriptionsTable.update(subscription.id, {
        code: code
      });

      setLinkSuccess(true);
      setTimeout(() => setLinkSuccess(false), 3000); // Clear success message after 3 seconds

    } catch (err) {
      console.error('Error linking wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to link wallet');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSubscribe() {
    if (!publicKey || !signTransaction) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Create subscription payment transaction
      const connection = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL!);
      const subscriptionPubkey = new PublicKey(process.env.NEXT_PUBLIC_SUBSCRIPTION_WALLET!);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: subscriptionPubkey,
          lamports: LAMPORTS_PER_SOL * SUBSCRIPTION_COST // Convert SOL to lamports
        })
      );

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign and send transaction
      const signedTx = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      // Wait for confirmation
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      // Create subscription record
      await createSubscription(signature, publicKey.toString(), code || '');
      
      // Update status
      setSubscriptionStatus('active');
      
    } catch (err) {
      console.error('Subscription error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process subscription');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="min-h-screen pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Add Link Wallet button if code is present */}
        {code && !linkSuccess && (
          <div className="absolute top-24 right-4">
            <button
              onClick={handleLinkWallet}
              disabled={!connected || isProcessing}
              className={`px-4 py-2 rounded-lg text-sm font-semibold
                ${isProcessing 
                  ? 'bg-gray-700 cursor-not-allowed' 
                  : 'bg-gold hover:bg-gold/80 text-black'
                } transition-colors duration-200`}
            >
              {isProcessing ? 'Linking...' : 'Link Wallet'}
            </button>
            {error && (
              <div className="absolute top-full right-0 mt-2 text-xs text-red-400 bg-red-900/30 p-2 rounded-lg border border-red-500/20 whitespace-nowrap">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Show success message when link is successful */}
        {linkSuccess && (
          <div className="absolute top-24 right-4 px-4 py-2 bg-green-900/30 text-green-400 rounded-lg border border-green-500/20 text-sm">
            Wallet linked successfully ✨
          </div>
        )}

        <div className="bg-black/50 border border-gold/20 rounded-lg p-8">
          <h1 className="text-3xl font-bold mb-6 text-gold">
            KinKong Copilot Subscription
          </h1>

          <div className="space-y-6">
            {/* Features Section */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gold">Features</h2>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    Advanced AI Trading Analysis
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    Real-time Market Insights
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    Portfolio Optimization
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    Risk Management Guidance
                  </li>
                </ul>
              </div>

              {/* Subscription Details */}
              <div className="bg-black/30 p-6 rounded-lg border border-gold/10">
                <h2 className="text-xl font-semibold text-gold mb-4">
                  Subscription Details
                </h2>
                <div className="space-y-2">
                  <p>Cost: {SUBSCRIPTION_COST} SOL</p>
                  <p>Duration: {SUBSCRIPTION_DURATION}</p>
                  <p>Access: Immediate</p>
                </div>
              </div>
            </div>

            {/* Status and Action Section */}
            <div className="mt-8 space-y-4">
              {!connected ? (
                <div className="text-yellow-400">
                  Please connect your wallet to subscribe
                </div>
              ) : subscriptionStatus === 'loading' ? (
                <div className="animate-pulse text-gray-400">
                  Checking subscription status...
                </div>
              ) : subscriptionStatus === 'active' ? (
                <div className="bg-green-900/30 text-green-400 p-4 rounded-lg border border-green-500/20">
                  Your subscription is active! ✨
                </div>
              ) : (
                <button
                  onClick={handleSubscribe}
                  disabled={isProcessing}
                  className={`w-full py-3 px-6 rounded-lg text-center font-semibold
                    ${isProcessing 
                      ? 'bg-gray-700 cursor-not-allowed' 
                      : 'bg-gold hover:bg-gold/80 text-black'
                    } transition-colors duration-200`}
                >
                  {isProcessing ? 'Processing...' : 'Subscribe Now'}
                </button>
              )}

              {error && (
                <div className="text-red-400 bg-red-900/30 p-4 rounded-lg border border-red-500/20">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
