'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, PublicKey as SolanaPublicKey } from '@solana/web3.js';
import { createSubscription } from '@/utils/subscription';
import AnimatedAdvice from '@/components/copilot/AnimatedAdvice';
import AnimatedChatBubble from '@/components/copilot/AnimatedChatBubble';

// Function to send Telegram notifications
async function sendSubscriptionNotification(subscriptionData: any) {
  try {
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const chatId = "-1001699255893"; // The specified chat ID
    
    if (!botToken) {
      console.warn("Telegram bot token not found in environment variables");
      return false;
    }
    
    // Format wallet address for display
    const wallet = subscriptionData.wallet;
    const walletDisplay = wallet.substring(0, 10) + '...' + wallet.substring(wallet.length - 10);
    
    // Create message text
    const message = `🎉 *New Kong Copilot Subscription*
    
💰 *Amount*: ${subscriptionData.amount.toLocaleString()} ${subscriptionData.token}
👤 *Subscriber*: \`${walletDisplay}\`
⏱ *Duration*: ${subscriptionData.duration} days
🔄 *Type*: ${subscriptionData.token === 'UBC' ? 'Kong Pro - UBC' : 'Kong Pro - COMPUTE'}

🔗 [View Transaction](${subscriptionData.solscanUrl})
`;
    
    // Send the image with caption
    try {
      // First try to send with image
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('caption', message);
      formData.append('parse_mode', 'Markdown');
      
      // Fetch the image and append it to the form
      const imageResponse = await fetch('/copilot.png');
      const imageBlob = await imageResponse.blob();
      formData.append('photo', imageBlob, 'copilot.png');
      
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }
    } catch (imageError) {
      console.warn('Failed to send image, falling back to text-only message', imageError);
      
      // Fallback to text-only message if image fails
      const textResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        }),
      });
      
      if (!textResponse.ok) {
        throw new Error(`Telegram API error: ${textResponse.status}`);
      }
    }
    
    console.log('Telegram subscription notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return false;
  }
}

// Define proper types for the tiers
type TierButton = {
  text: string | JSX.Element;
  action: () => void;
  style: string;
};

type Tier = {
  name: string;
  description: string;
  features: string[];
  price?: string | JSX.Element;
  action?: () => void;
  buttonText?: string | JSX.Element;
  buttonStyle?: string;
  buttons?: TierButton[];
};

export default function CopilotPage() {
  const router = useRouter();
  const { connected, publicKey, sendTransaction } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add subscription constants
  const TOKEN_ADDRESSES = {
    UBC: '9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump',
    COMPUTE: 'B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo'
  };

  const SUBSCRIPTION_COSTS = {
    UBC: 14999,     // Discounted from 59999
    COMPUTE: 149999 // Discounted from 599999
  };

  const SUBSCRIPTION_DURATIONS = {
    UBC: 30, // 1 month in days
    COMPUTE: 30 // 1 month in days
  };

  const features = [
    {
      title: "Chrome Extension",
      description: "Access KinKong's intelligence directly in your browser while trading",
      icon: "🌐"
    },
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
      title: "UBC Ecosystem Integration",
      description: "Direct access to UBC news, updates, and cross-swarm intelligence",
      icon: "🔄"
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

  const tiers: Tier[] = [
    {
      name: "Free Tier",
      description: "Get started with basic access",
      features: [
        "10 messages per day",
        "Basic technical analysis",
        "Standard response time",
        "Public signals access"
      ],
      action: () => {
        if (!connected) {
          setError('Please connect your wallet to continue');
          return;
        }
        router.push('/copilot/start');
      },
      buttonText: "Start Free",
      buttonStyle: "bg-gray-800 hover:bg-gray-700"
    },
    {
      name: "Kong Pro - $UBC",
      description: "Full access to KinKong intelligence",
      features: [
        "Extended Kong Copilot message capacity",
        "Exclusive Kong Copilot missions",
        "Exclusive Kong Copliot alpha signals",
        "+25% returns on Kong Invest",
        "Stronger guarantees on Kong Invest"
      ],
      price: (
        <span>
          <span className="line-through text-gray-400 mr-2">59,999</span>
          <span>14,999</span> <span className="metallic-text-ubc">$UBC</span> / 1 month
          <span className="ml-2 bg-gold/20 text-gold text-xs px-2 py-0.5 rounded-full">75% OFF</span>
        </span>
      ),
      action: () => handlePremiumSubscription('UBC'),
      buttonText: <span>Upgrade with $UBC</span>, 
      buttonStyle: "bg-gradient-to-r from-purple-700 to-blue-700 text-white"
    },
    {
      name: "Kong Pro - $COMPUTE",
      description: "Full access to KinKong intelligence",
      features: [
        "Extended Kong Copilot message capacity",
        "Exclusive Kong Copilot missions",
        "Exclusive Kong Copliot alpha signals",
        "+25% returns on Kong Invest",
        "Stronger guarantees on Kong Invest",
        "Chrome extension access"
      ],
      price: (
        <span>
          <span className="line-through text-gray-400 mr-2">599,999</span>
          <span>149,999</span> <span className="metallic-text-compute">$COMPUTE</span> / 1 month
          <span className="ml-2 bg-gold/20 text-gold text-xs px-2 py-0.5 rounded-full">75% OFF</span>
        </span>
      ),
      action: () => handlePremiumSubscription('COMPUTE'),
      buttonText: <span>Upgrade with $COMPUTE</span>, 
      buttonStyle: "bg-gradient-to-r from-blue-700 to-cyan-700 text-white"
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
      
      // Check user's token balance
      try {
        const tokenBalance = await connection.getTokenAccountBalance(sourceTokenAccount);
        console.log(`User's ${paymentMethod} balance:`, tokenBalance.value);
        
        if (Number(tokenBalance.value.amount) < tokenAmount * Math.pow(10, tokenBalance.value.decimals)) {
          throw new Error(`Not enough ${paymentMethod} tokens. You need ${tokenAmount} ${paymentMethod}.`);
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('Not enough')) {
          throw err;
        }
        console.error('Error checking token balance:', err);
        // Continue even if we can't check the balance - the transaction will fail if insufficient
      }
      
      // Use the decimals from the token account balance instead of fetching token info
      let tokenDecimals = 9; // Default to 9 decimals if we can't determine
      
      try {
        const tokenBalance = await connection.getTokenAccountBalance(sourceTokenAccount);
        tokenDecimals = tokenBalance.value.decimals;
        console.log(`Token decimals for ${paymentMethod}: ${tokenDecimals}`);
      } catch (err) {
        console.warn(`Couldn't determine token decimals, using default of ${tokenDecimals}:`, err);
      }
      
      // Calculate amount with proper decimals
      const adjustedAmount = BigInt(tokenAmount) * BigInt(10 ** tokenDecimals);
      console.log(`Sending ${tokenAmount} ${paymentMethod} (${adjustedAmount} raw amount)`);
      
      // Add transfer instruction with correct decimal calculation
      transaction.add(
        createTransferInstruction(
          sourceTokenAccount, // source
          destinationTokenAccount, // destination
          publicKey, // owner
          adjustedAmount // amount with proper decimals
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

      // Send Telegram notification
      try {
        await sendSubscriptionNotification({
          token: paymentMethod,
          amount: tokenAmount,
          wallet: publicKey.toString(),
          solscanUrl: `https://solscan.io/tx/${signature}`,
          duration: SUBSCRIPTION_DURATIONS[paymentMethod]
        });
      } catch (notifyError) {
        console.error('Failed to send notification, but subscription was successful:', notifyError);
      }

      // Redirect to start page instead of chat
      router.push(`/copilot/start`);

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
        <div className="text-center space-y-10 py-12 mb-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="relative mt-20">
              <img 
                src="/copilot.png" 
                alt="KinKong Copilot" 
                className="w-40 h-40 md:w-48 md:h-48 object-contain"
              />
              <AnimatedChatBubble />
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-bold">
                Kong <span className="white-glow-text">Copilot</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Your AI-powered trading assistant with KinKong's market intelligence, directly in your browser
              </p>
            </div>
          </div>
          <div className="max-w-2xl mx-auto">
          </div>
        </div>

        {/* Chrome Extension Promotion */}
        <div className="p-8 bg-gradient-to-r from-black/60 to-purple-900/30 border-2 border-gold/40 rounded-lg text-center mb-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 -mt-10 -mr-10 opacity-20">
            <img src="/chrome-logo.png" alt="Chrome" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-gold">KinKong Copilot Chrome Extension</h2>
          <p className="text-xl text-gray-300 mb-6 max-w-3xl mx-auto">
            Access KinKong's AI-powered trading intelligence directly in your browser with our official Chrome extension.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="https://chromewebstore.google.com/detail/KinKong%20Copilot/pppphicmiiioggjhcbcbbghcdgbihbji"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-bold text-white hover:scale-105 transition-all flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Install Chrome Extension
            </a>
          </div>
          <div className="mt-6 text-gray-400 text-sm">
            Enhance your trading experience with real-time insights, portfolio analysis, and market intelligence.
          </div>
        </div>

        {/* Wallet Connection - Add this section */}
        {!connected && (
          <div className="p-6 bg-black/40 border-2 border-gold/40 rounded-lg text-center mb-8">
            <h2 className="text-xl font-bold mb-4 text-gold">Connect Your Wallet to Continue</h2>
            <p className="text-gray-300 mb-6">
              KinKong Copilot requires a connected wallet for personalized trading insights and portfolio analysis.
            </p>
            <WalletConnect />
          </div>
        )}

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
                    <li key={i} className="flex items-start text-gray-300">
                      <span className="text-gold mr-2">•</span> {feature}
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
                {isProcessing ? 'Processing...' : (
                  typeof tier.buttonText === 'string' ? tier.buttonText : tier.buttonText
                )}
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

        {/* Trading Advice Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-center">Trading Wisdom</h2>
          <AnimatedAdvice />
        </div>

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
