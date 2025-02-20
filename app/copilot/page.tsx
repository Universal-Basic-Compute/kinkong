'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { verifySubscription } from '@/utils/subscription';

export default function CopilotSubscriptionPage() {
  const { publicKey, signTransaction, connected } = useWallet();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code');
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'inactive' | 'loading'>('loading');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
  const [confirmingTx, setConfirmingTx] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [subscription, setSubscription] = useState<{active: boolean; expiresAt?: string} | null>(null);

  const SUBSCRIPTION_COST = 1.5; // SOL
  const SUBSCRIPTION_DURATION = '3 months';

  useEffect(() => {
    checkSubscription();
    return () => {
      // Cleanup any pending state updates
      setIsProcessing(false);
      setConfirmingTx(false);
      setError(null);
    };
  }, [code]);

  async function checkSubscription() {
    if (!code) {
      setSubscriptionStatus('inactive');
      return;
    }

    try {
      setIsCheckingSubscription(true);
      setSubscriptionStatus('loading');
      const result = await verifySubscription(code);
      setSubscriptionStatus(result.active ? 'active' : 'inactive');
      setSubscription(result);
    } catch (err) {
      console.error('Error checking subscription:', err);
      setSubscriptionStatus('inactive');
      setSubscription(null);
    } finally {
      setIsCheckingSubscription(false);
    }
  }

  async function createSubscription(signature: string, wallet: string, code: string | null) {
    try {
      const response = await fetch('/api/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signature,
          wallet,
          code
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create subscription');
      }

      return await response.json();
    } catch (error) {
      console.error('Subscription creation error:', error);
      throw error;
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

      // Check balance
      const connection = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL!);
      const balance = await connection.getBalance(publicKey);
      if (balance < LAMPORTS_PER_SOL * SUBSCRIPTION_COST) {
        setError(`Insufficient balance. Need ${SUBSCRIPTION_COST} SOL`);
        return;
      }

      const subscriptionPubkey = new PublicKey(process.env.NEXT_PUBLIC_SUBSCRIPTION_WALLET!);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: subscriptionPubkey,
          lamports: LAMPORTS_PER_SOL * SUBSCRIPTION_COST
        })
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signedTx = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      setConfirmingTx(true);
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      await createSubscription(signature, publicKey.toString(), code || '');
      setSubscriptionStatus('active');
      router.push('/copilot/start');
      
    } catch (err) {
      console.error('Subscription error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process subscription');
    } finally {
      setIsProcessing(false);
      setConfirmingTx(false);
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
                  disabled={isProcessing || confirmingTx || !connected}
                  className={`w-full py-3 px-6 rounded-lg text-center font-semibold
                    ${isProcessing || confirmingTx
                      ? 'bg-gray-700 cursor-not-allowed' 
                      : !connected
                      ? 'bg-gray-700 cursor-not-allowed'
                      : 'bg-gold hover:bg-gold/80 text-black'
                    } transition-colors duration-200`}
                >
                  {isProcessing 
                    ? 'Processing...' 
                    : confirmingTx
                    ? 'Confirming Transaction...'
                    : !connected
                    ? 'Connect Wallet to Subscribe'
                    : 'Subscribe Now'}
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
'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { verifySubscription } from '@/utils/subscription';

export default function CopilotPage() {
  const { publicKey, connected } = useWallet();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) {
      setIsLoading(false);
      return;
    }

    checkSubscription();
  }, [connected, publicKey]);

  async function checkSubscription() {
    try {
      setIsLoading(true);
      setError(null);

      // If no subscription, redirect to subscription page
      router.push('/copilot/start');

    } catch (err) {
      console.error('Error checking subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to check subscription');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-bold mb-2">Loading...</div>
          <div className="text-gray-400">Checking subscription status</div>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-gray-400">
            Please connect your wallet to access KinKong Copilot
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return null; // Will redirect to /copilot/start
}
