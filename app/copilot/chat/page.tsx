'use client';
export const dynamic = 'force-dynamic';

import { useSearchParams, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { ChatProvider } from '@/app/context/ChatContext';
import MissionSidebar from '@/components/copilot/MissionSelector';
import UserProfileSidebar from '@/components/copilot/UserProfileSidebar';
import ChatInterface from '@/components/copilot/ChatInterface';
import { useState, useEffect } from 'react';

// Custom scrollbar styles
const scrollbarStyles = `
  /* Custom scrollbar styles */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  
  ::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
  
  ::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.6);
    border-radius: 3px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.8);
  }
  
  /* Firefox scrollbar */
  * {
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.6) rgba(0, 0, 0, 0.2);
  }
`;

export default function CopilotChatPage() {
  const { publicKey, connected } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams?.get('code') || null;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if wallet is connected
    if (connected) {
      setLoading(false);
    } else {
      // Keep loading state true if wallet is not connected
      setLoading(true);
      
      // Check if we should auto-connect
      const shouldAutoConnect = localStorage.getItem('autoConnectWallet') === 'true';
      if (shouldAutoConnect) {
        console.log('Auto-connect wallet feature is enabled');
      }
    }
  }, [connected]);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex flex-col items-center justify-center">
        {!connected ? (
          <div className="max-w-md w-full p-6 bg-black/40 border border-gold/20 rounded-lg text-center space-y-6">
            <h2 className="text-2xl font-bold text-gold">Connect Your Wallet</h2>
            <p className="text-gray-300 mb-4">
              Please connect your wallet to use KinKong Copilot. Your wallet is required for personalized trading insights.
            </p>
            <WalletConnect />
          </div>
        ) : (
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
        )}
      </div>
    );
  }

  // If no code is provided, use a default code
  if (!code) {
    // Set a default code for users without one
    const defaultCode = 'default-access';
    
    // Redirect to the same page but with the default code
    router.replace(`/copilot/chat?code=${defaultCode}`);
    
    // Show loading while redirecting
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <ChatProvider code={code}>
      <div className="fixed inset-0 top-16 bottom-0 flex overflow-hidden">
        {/* Add the style tag for custom scrollbars */}
        <style jsx global>{scrollbarStyles}</style>
        
        {/* Left Sidebar - Missions */}
        <MissionSidebar />

        {/* Center - Chat Interface */}
        <ChatInterface />

        {/* Right Sidebar - User Preferences */}
        <UserProfileSidebar />
      </div>
    </ChatProvider>
  );
}
