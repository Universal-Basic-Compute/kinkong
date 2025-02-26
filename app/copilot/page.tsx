'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, PublicKey as SolanaPublicKey } from '@solana/web3.js';
import { createSubscription } from '@/utils/subscription';

export default function CopilotPage() {
  const router = useRouter();
  const { connected, publicKey, sendTransaction } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add subscription constants
  const TOKEN_ADDRESSES = {
    UBC: 'UBCGiYTxvAfxRCpubCQe5xJgxZTZhzSG4A3S3T4ch1v',
    COMPUTE: 'CPTx4EHKR92ZMqDxP8kxQUBkQ3NHw6Mcz6MYjyuVfgXf'
  };

  const SUBSCRIPTION_COSTS = {
    UBC: 75000,
    COMPUTE: 750000
  };

  const SUBSCRIPTION_DURATIONS = {
    UBC: 30, // 1 month in days
    COMPUTE: 30 // 1 month in days
  };

  const features = [
    {
      title: "Technical Analysis Integration",
      description: "Access KinKong's real-time technical analysis and trading signals",
      icon: "📊"
    },
    {
      title: "Market Sentiment Analysis", 
      description: "Get instant insights from social media, news, and on-chain data",
      icon: "🎯"
    },
    {
      title: "Community Alpha Access",
      description: "Tap into the collective intelligence of the UBC community",
      icon: "👥"
    },
    {
      title: "UBC Ecosystem Integration",
      description: "Direct access to UBC news, updates, and cross-swarm intelligence",
      icon: "🌐"
    },
    {
      title: "Trading Signals",
      description: "Real-time alerts and trading opportunities across multiple timeframes",
      icon: "💡"
    },
    {
      title: "AI-Powered Insights",
      description: "Advanced analysis combining multiple data sources and strategies",
      icon: "🤖"
    }
  ];

  const tiers = [
    {
      name: "Free Tier",
      description: "Get started with basic access",
      features: [
        "10 messages per day",
        "Basic technical analysis",
        "Standard response time",
        "Public signals access"
      ],
      action: () => router.push('/copilot/start'),
      buttonText: "Start Free",
      buttonStyle: "bg-gray-800 hover:bg-gray-700"
    },
    {
      name: "Kong Pro - UBC",
      description: "Full access to KinKong intelligence",
      features: [
        "100 messages per 8-hour block",
        "Advanced technical analysis",
        "Priority response time",
        "Exclusive alpha signals",
        "Custom trading strategies",
        "Direct ecosystem integration"
      ],
      price: <span>75,000 <span className="metallic-text-ubc">UBC</span> / 1 month</span>,
      action: () => handlePremiumSubscription('UBC'),
      buttonText: "Upgrade with UBC", 
      buttonStyle: "bg-gradient-to-r from-purple-600 to-blue-500 text-white"
    },
    {
      name: "Kong Pro - COMPUTE",
      description: "Full access to KinKong intelligence",
      features: [
        "100 messages per 8-hour block",
        "Advanced technical analysis",
        "Priority response time",
        "Exclusive alpha signals",
        "Custom trading strategies",
        "Direct ecosystem integration"
      ],
      price: <span>750,000 <span className="metallic-text-compute">COMPUTE</span> / 1 month</span>,
      action: () => handlePremiumSubscription('COMPUTE'),
      buttonText: "Upgrade with COMPUTE", 
      buttonStyle: "bg-gradient-to-r from-blue-600 to-cyan-500 text-white"
    }
  ];

  async function handlePremiumSubscription(paymentMethod: 'UBC' | 'COMPUTE') {
    if (!connected || !publicKey) {
      // The WalletConnect component will show the connect modal
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Validate subscription wallet address
      const subscriptionWalletAddress = process.env.NEXT_PUBLIC_SUBSCRIPTION_WALLET;
      if (!subscriptionWalletAddress) {
        throw new Error('Subscription wallet not configured');
      }

      let subscriptionWallet: PublicKey;
      try {
        subscriptionWallet = new PublicKey(subscriptionWalletAddress);
      } catch (err) {
        console.error('Invalid subscription wallet address:', err);
        throw new Error('Invalid subscription wallet configuration');
      }

      // Create connection
      const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
      if (!rpcUrl) {
        throw new Error('RPC URL not configured');
      }
      
      const connection = new Connection(rpcUrl, 'confirmed');
      
      // Handle token transfers (UBC or COMPUTE)
      const tokenMint = new PublicKey(TOKEN_ADDRESSES[paymentMethod]);
      const tokenAmount = SUBSCRIPTION_COSTS[paymentMethod];
      
      // Import required token program functions
      const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
      const { TOKEN_PROGRAM_ID, createTransferInstruction } = await import('@solana/spl-token');
      
      // Get source token account (user's wallet)
      const sourceTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        publicKey
      );
      
      // Get destination token account (subscription wallet)
      const destinationTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        subscriptionWallet
      );
      
      // Check if destination token account exists
      const destinationAccountInfo = await connection.getAccountInfo(destinationTokenAccount);
      
      // Create transaction
      const transaction = new Transaction();
      
      // If destination account doesn't exist, create it
      if (!destinationAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey, // payer
            destinationTokenAccount, // associated token account
            subscriptionWallet, // owner
            tokenMint // token mint
          )
        );
      }
      
      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          sourceTokenAccount, // source
          destinationTokenAccount, // destination
          publicKey, // owner
          tokenAmount * 10**9 // amount (with decimals)
        )
      );
      
      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      console.log(`${paymentMethod} payment sent:`, signature);

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature);
      
      if (confirmation.value.err) {
        throw new Error('Transaction failed');
      }

      // Create subscription record with appropriate duration
      const code = Math.random().toString(36).substring(2, 15);
      await createSubscription(
        signature, 
        publicKey.toString(), 
        code, 
        paymentMethod, 
        SUBSCRIPTION_DURATIONS[paymentMethod]
      );

      // Redirect to chat with code
      router.push(`/copilot/chat?code=${code}`);

    } catch (err) {
      console.error('Subscription error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process subscription');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="min-h-screen pt-20 px-4">
      <div className="max-w-6xl mx-auto space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold">
            KinKong <span className="white-glow-text">Copilot</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Your AI-powered trading assistant with direct access to KinKong's intelligence
            and the UBC ecosystem's collective wisdom.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="p-6 bg-black/30 border border-gold/20 rounded-lg hover:border-gold/40 transition-all"
            >
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold mb-2 text-gold">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Pricing Tiers */}
        <div className="grid md:grid-cols-3 gap-6">
          {error && (
            <div className="md:col-span-2 p-4 bg-red-900/50 border border-red-500 rounded-lg text-center text-red-200">
              {error}
            </div>
          )}
          {tiers.map((tier, index) => (
            <div 
              key={index}
              className="p-8 bg-black/30 border border-gold/20 rounded-lg hover:border-gold/40 transition-all flex flex-col"
            >
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                <p className="text-gray-400 mb-4">{tier.description}</p>
                {tier.price && (
                  <div className="text-xl font-bold text-gold mb-4">
                    {typeof tier.price === 'string' ? tier.price : tier.price}
                  </div>
                )}
                <ul className="space-y-2 mb-6">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-center text-gray-300">
                      <span className="text-gold mr-2">✓</span> {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={tier.action}
                disabled={isProcessing}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all
                  ${tier.buttonStyle}
                  ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
              >
                {isProcessing ? 'Processing...' : tier.buttonText}
              </button>
            </div>
          ))}
        </div>

        {/* Wallet Connection */}
        {!connected && (
          <div className="text-center">
            <WalletConnect />
          </div>
        )}

        {/* Bottom CTA */}
        <div className="text-center pb-8">
          <p className="text-gray-400">
            Join our{' '}
            <a 
              href="https://t.me/ubc_portal" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gold hover:text-gold/80"
            >
              Telegram community
            </a>
            {' '}for support and updates
          </p>
        </div>
      </div>
    </div>
  );
}
