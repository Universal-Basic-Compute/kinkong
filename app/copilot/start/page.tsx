'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { OnboardingProvider, useOnboarding } from '@/app/context/OnboardingContext';
import OnboardingContainer from '@/app/components/onboarding/OnboardingContainer';

export default function CopilotStartPage() {
  return (
    <div className="min-h-screen pt-20 px-4">
      <OnboardingProvider>
        <StartPageContent />
      </OnboardingProvider>
    </div>
  );
}

function StartPageContent() {
  const { connected } = useWallet();
  const router = useRouter();
  const { isCompleted, currentStep } = useOnboarding();
  const [showExtensionGuide, setShowExtensionGuide] = useState(false);

  useEffect(() => {
    // If onboarding is completed, show the extension guide
    if (isCompleted) {
      setShowExtensionGuide(true);
    }
  }, [isCompleted]);



  // Always show onboarding container for all users
  // This ensures everyone goes through the onboarding process
  return <OnboardingContainer />;

  // The code below is not reached due to the early return above
  // It's kept for reference or future use
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">
          Get Started with <span className="white-glow-text">KinKong Copilot</span>
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Install the KinKong Copilot Chrome extension to enhance your trading experience.
        </p>
      </div>

      {/* Chrome Web Store Button */}
      <div className="bg-black/50 border border-gold/20 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-6 text-gold">
          Install from Chrome Web Store
        </h2>
        
        <div className="flex flex-col items-center space-y-6">
          <img 
            src="/chrome-logo.png" 
            alt="Chrome Web Store" 
            className="w-24 h-24 object-contain"
          />
          
          <p className="text-gray-300 max-w-2xl">
            KinKong Copilot is now available on the Chrome Web Store. Click the button below to install it directly to your browser.
          </p>
          
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
          
          <div className="flex items-center bg-black/50 px-4 py-2 rounded-lg">
            <span className="text-green-400 mr-2">✓</span>
            <span className="text-gray-300">10,000+ Users</span>
          </div>
        </div>
      </div>

      {/* How to Use Section */}
      <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-gold">
          How to Use KinKong Copilot
        </h2>
        
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-black/30">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-gold via-amber-500 to-yellow-500 text-black">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Install the Extension</h3>
                <p className="text-gray-400 text-sm">
                  Click the install button above to add KinKong Copilot to your Chrome browser.
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-black/30">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-gold via-amber-500 to-yellow-500 text-black">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Pin the Extension</h3>
                <p className="text-gray-400 text-sm">
                  Click the puzzle piece icon in Chrome, then pin KinKong Copilot for easy access.
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-black/30">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-gold via-amber-500 to-yellow-500 text-black">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Connect Your Wallet</h3>
                <p className="text-gray-400 text-sm">
                  Click the KinKong Copilot icon and connect your Solana wallet to access all features.
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-black/30">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-gold via-amber-500 to-yellow-500 text-black">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Start Trading with AI Assistance</h3>
                <p className="text-gray-400 text-sm">
                  Use KinKong Copilot while browsing trading sites for real-time insights and analysis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Continue to Chat Button */}
      <div className="text-center mt-8">
        <button
          onClick={() => {
            // Force navigation to the chat page with the code parameter
            const searchParams = new URLSearchParams(window.location.search);
            const code = searchParams.get('code') || 'default';
            router.push(`/copilot/chat?code=${code}`);
          }}
          className="px-8 py-3 bg-gradient-to-r from-gold to-amber-500 text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
        >
          Continue to KinKong Chat
        </button>
      </div>

      {/* Support Section */}
      <div className="bg-black/30 border border-gold/20 rounded-lg p-6 text-center">
        <h3 className="text-xl font-bold mb-2">Need Help?</h3>
        <p className="text-gray-400 mb-4">
          Having trouble installing the extension? Join our community for support.
        </p>
        <a 
          href="https://t.me/ubc_portal"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold hover:text-gold/80 transition-colors duration-200"
        >
          Join Telegram Community →
        </a>
      </div>
    </div>
  );
}
