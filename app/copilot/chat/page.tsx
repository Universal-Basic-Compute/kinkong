'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { askKinKongCopilot } from '@/utils/copilot';
import { useWallet } from '@solana/wallet-adapter-react';
import { verifySubscription } from '@/utils/subscription';
import { useOnboarding } from '@/app/context/OnboardingContext';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { Tooltip } from '@/components/ui/tooltip';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  screenshot?: string; // Base64 encoded screenshot
}

export default function CopilotChatPage() {
  const { publicKey, connected } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [typingMessage, setTypingMessage] = useState<string | null>(null);
  const [displayedParagraphs, setDisplayedParagraphs] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [subscription, setSubscription] = useState<{active: boolean; expiresAt?: string} | null>(null);
  const [currentMission, setCurrentMission] = useState<string | null>(null);
  
  const missions = [
    {
      id: 'token-discovery',
      title: '🔍 Token Discovery',
      description: 'Find promising new tokens with strong fundamentals',
      context: 'Help me analyze emerging tokens on Solana with strong fundamentals. Let\'s evaluate liquidity, volume trends, and holder distribution to create a watchlist of promising tokens for potential investment.'
    },
    {
      id: 'portfolio-rebalancing',
      title: '⚖️ Portfolio Rebalancing',
      description: 'Optimize your current portfolio allocation',
      context: 'I need help assessing my current portfolio allocation and performance. Let\'s identify underperforming assets and potential replacements to create a step-by-step rebalancing plan based on current market conditions.'
    },
    {
      id: 'technical-analysis',
      title: '📊 Technical Analysis',
      description: 'Learn to identify key chart patterns',
      context: 'I want to learn how to identify key chart patterns on specific tokens. Let\'s practice support/resistance identification and develop a personalized trading strategy based on technical indicators.'
    },
    {
      id: 'risk-management',
      title: '🛡️ Risk Management',
      description: 'Improve your position sizing and stop-loss strategies',
      context: 'Help me evaluate my current position sizing and stop-loss strategies. I want to calculate optimal risk-reward ratios based on volatility and create a risk management framework aligned with my risk tolerance.'
    },
    {
      id: 'defi-yield',
      title: '💰 DeFi Yield',
      description: 'Find the best yield opportunities on Solana',
      context: 'Let\'s discover the highest-yielding DeFi protocols on Solana. I want to compare risks and rewards across lending platforms and liquidity pools to develop a yield farming strategy based on my risk profile.'
    },
    {
      id: 'sentiment-analysis',
      title: '🔮 Market Sentiment',
      description: 'Track social media trends and community sentiment',
      context: 'I want to track social media trends and community sentiment for key tokens. Let\'s correlate sentiment indicators with price action and create alerts for significant sentiment shifts that could impact prices.'
    },
    {
      id: 'swing-trading',
      title: '🔄 Swing Trading',
      description: 'Identify potential swing trading opportunities',
      context: 'Help me identify potential swing trading opportunities in the current market. Let\'s analyze optimal entry and exit points with specific price targets and develop a tracking system for managing multiple swing positions.'
    },
    {
      id: 'on-chain-data',
      title: '🐋 On-Chain Data',
      description: 'Explore whale wallet movements and smart money flows',
      context: 'Let\'s explore whale wallet movements and smart money flows. I want to analyze token distribution and concentration metrics to identify potential accumulation or distribution patterns before they affect price.'
    }
  ];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { onboardingData, isCompleted } = useOnboarding();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We'll assume if they got to the chat page, they should be allowed to use it
    // This prevents a redirect loop between start and chat pages
    
    checkSubscription();
    setLoading(false);
  }, [publicKey, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function checkSubscription() {
    if (!code) {
      // Even without a code, set a default active subscription
      setSubscription({ active: true });
      return;
    }

    try {
      // Get the actual subscription status but don't use it to block access
      const result = await verifySubscription(code);
      // Override the active status to always be true
      setSubscription({ ...result, active: true });
    } catch (err) {
      console.error('Error checking subscription:', err);
      // Even on error, set a default active subscription
      setSubscription({ active: true });
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const animateMessageTyping = useCallback((message: string) => {
    // Split message into paragraphs (by double newlines or markdown headers)
    const paragraphs = message.split(/\n\n|\n#{1,6} /);
    const cleanParagraphs = paragraphs.map(p => p.trim()).filter(p => p.length > 0);
    
    setTypingMessage(message);
    setDisplayedParagraphs([]);
    setIsTyping(true);
    
    // Display paragraphs one by one
    let displayedSoFar: string[] = [];
    
    const showNextParagraph = (index: number) => {
      if (index >= cleanParagraphs.length) {
        // All paragraphs displayed, finish typing
        setIsTyping(false);
        setTypingMessage(null);
        return;
      }
      
      // Add the next paragraph
      displayedSoFar = [...displayedSoFar, cleanParagraphs[index]];
      setDisplayedParagraphs([...displayedSoFar]);
      
      // Calculate read time based on paragraph length - faster speed
      const readTime = Math.max(500, cleanParagraphs[index].length * 15); // Reduced from 30 to 15ms per character
      
      // Schedule next paragraph
      setTimeout(() => showNextParagraph(index + 1), readTime);
    };
    
    // Start displaying paragraphs
    showNextParagraph(0);
  }, []);
  
  const handleSelectMission = (missionTitle: string, context: string, missionId: string) => {
    // Store the mission ID
    setCurrentMission(missionId);
    
    // Add a system message to indicate the mission selection
    const systemMessage: Message = {
      role: 'assistant',
      content: `🚀 **Mission Selected: ${missionTitle}**\n\nI'm ready to help you with this mission! Let's get started.`,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, systemMessage]);
    
    // Automatically set the input field with the context
    setInput(context);
  };

  const captureScreenshot = async () => {
    try {
      setIsCapturing(true);
      setError(null);
      
      // Use browser's screenshot API if available (Chrome extension only)
      if (window.navigator && 'mediaDevices' in navigator) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: { mediaSource: 'screen' } 
        });
        
        const track = stream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(track);
        const bitmap = await imageCapture.grabFrame();
        
        // Convert to canvas then to base64
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        context?.drawImage(bitmap, 0, 0);
        
        // Get base64 data
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);
        setScreenshot(base64Image);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      } else {
        throw new Error('Screen capture not supported in this browser');
      }
    } catch (err) {
      console.error('Screenshot error:', err);
      setError(err instanceof Error ? err.message : 'Failed to capture screenshot');
    } finally {
      setIsCapturing(false);
    }
  };

  const clearScreenshot = () => {
    setScreenshot(null);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !publicKey) return;

    try {
      setIsLoading(true);
      setError(null);

      // Add user message
      const userMessage: Message = {
        role: 'user',
        content: input,
        timestamp: new Date().toISOString(),
        screenshot: screenshot || undefined
      };
      setMessages(prev => [...prev, userMessage]);
      setInput('');

      // Get wallet address if connected
      const walletAddress = publicKey ? publicKey.toString() : undefined;

      // Get streaming response with wallet address, mission, and screenshot if available
      const response = await askKinKongCopilot(
        input, 
        code || 'default', 
        walletAddress, // Always pass wallet address if available
        screenshot || undefined,
        currentMission // Pass the current mission ID
      );
    
      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Start typing animation
      animateMessageTyping(response);
      
      // Clear screenshot after sending
      setScreenshot(null);

    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
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

  if (subscription && !subscription.active) {
    // Just log this information but don't block access
    console.log('User has an inactive subscription');
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Sidebar - Missions */}
      <div className="w-72 bg-black/40 border-r border-gold/20 p-4 h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gold">Select a Mission</h2>
          <Tooltip 
            content="Selecting a mission provides KinKong with specialized data and context, focusing the conversation on specific goals and strategies for better results."
            position="right"
          >
            <div className="text-gray-400 cursor-help hover:text-gold transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
          </Tooltip>
        </div>
        <div className="space-y-3">
          {missions.map((mission) => (
            <div
              key={mission.id}
              onClick={() => handleSelectMission(mission.title, mission.context, mission.id)}
              className="p-3 bg-black/50 border border-gold/20 rounded-lg cursor-pointer hover:bg-gold/10 hover:border-gold/40 transition-all"
            >
              <h3 className="font-medium text-gold">{mission.title}</h3>
            </div>
          ))}
        </div>
      </div>

      {/* Center - Chat Interface */}
      <div className="flex-1 flex flex-col h-screen">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* For user messages */}
                {message.role === 'user' && (
                  <div
                    className="max-w-[80%] rounded-lg p-3 bg-gold/10 text-gold"
                  >
                    {message.screenshot && (
                      <div className="mb-3 border border-gold/20 rounded-lg overflow-hidden">
                        <img 
                          src={message.screenshot} 
                          alt="Screenshot" 
                          className="max-w-full h-auto"
                        />
                        <div className="bg-black/50 p-2 text-xs text-gray-400">
                          Screenshot attached
                        </div>
                      </div>
                    )}
                    <ReactMarkdown className="prose prose-invert">
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
                
                {/* For assistant messages */}
                {message.role === 'assistant' && (
                  <>
                    {/* If this is the message currently being typed */}
                    {typingMessage && index === messages.length - 1 ? (
                      <div className="space-y-3 w-full">
                        {/* Display paragraphs that have been revealed so far */}
                        {displayedParagraphs.map((paragraph, pIndex) => (
                          <div key={pIndex} className="flex justify-start">
                            <div className="max-w-[80%] rounded-lg p-3 bg-gray-800/50 text-gray-200">
                              <ReactMarkdown className="prose prose-invert">
                                {paragraph}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ))}
                        
                        {/* Show typing indicator outside of bubble if still typing */}
                        {isTyping && (
                          <div className="flex items-center space-x-1 ml-3 mt-1">
                            <div className="w-2 h-2 bg-gold/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-gold/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-gold/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* For completed messages, split into separate bubbles */
                      <div className="space-y-3 w-full">
                        {message.content.split(/\n\n|\n#{1,6} /).map((paragraph, pIndex) => (
                          paragraph.trim() && (
                            <div key={pIndex} className="flex justify-start">
                              <div className="max-w-[80%] rounded-lg p-3 bg-gray-800/50 text-gray-200">
                                <ReactMarkdown className="prose prose-invert">
                                  {paragraph.trim()}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            
            {/* Add typing indicator before first message if no messages yet */}
            {messages.length === 0 && isTyping && (
              <div className="flex items-center space-x-1 ml-3 mt-1">
                <div className="w-2 h-2 bg-gold/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gold/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gold/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area - Fixed at bottom */}
        <div className="border-t border-gold/20 p-4 bg-black/30">
          {error && (
            <div className="text-red-400 text-sm mb-2">
              {error}
            </div>
          )}
          
          {/* Screenshot preview */}
          {screenshot && (
            <div className="mb-3 relative">
              <div className="border border-gold/30 rounded-lg overflow-hidden p-2 bg-black/30">
                <img 
                  src={screenshot} 
                  alt="Screenshot preview" 
                  className="max-h-40 w-auto mx-auto rounded"
                />
                <button
                  type="button"
                  onClick={clearScreenshot}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors"
                  title="Remove screenshot"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder="Ask KinKong Copilot..."
                className="flex-1 bg-black/30 border border-gold/20 rounded-lg px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gold"
              />
              
              {/* Screenshot button */}
              <button
                type="button"
                onClick={captureScreenshot}
                disabled={isLoading || isCapturing}
                className={`px-3 py-2 rounded-lg ${
                  isLoading || isCapturing
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                } transition-colors duration-200`}
                title="Capture screenshot"
              >
                {isCapturing ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </span>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
              
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={`px-6 py-2 rounded-lg font-semibold ${
                  isLoading || !input.trim()
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gold hover:bg-gold/80 text-black'
                } transition-colors duration-200`}
              >
                {isLoading ? 'Thinking...' : 'Send'}
              </button>
          </form>
        </div>
      </div>

      {/* Right Sidebar - User Preferences */}
      <div className="w-72 bg-black/40 border-l border-gold/20 p-4 h-screen overflow-y-auto">
        <h2 className="text-lg font-semibold text-gold mb-3">Your Personalized Settings</h2>
        <ul className="space-y-4">
          <li>
            <h3 className="font-medium text-sm uppercase text-gray-400">Experience</h3>
            <p className="text-gray-300 capitalize">
              {onboardingData.experience || 'Not specified'}
            </p>
          </li>
          <li>
            <h3 className="font-medium text-sm uppercase text-gray-400">Interests</h3>
            <p className="text-gray-300">
              {onboardingData.interests && onboardingData.interests.length > 0 
                ? onboardingData.interests.map(interest => {
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
              {onboardingData.incomeSource ? onboardingData.incomeSource.split('-').join(' ') : 'Not specified'}
            </p>
          </li>
          <li>
            <h3 className="font-medium text-sm uppercase text-gray-400">Risk Tolerance</h3>
            <p className="text-gray-300 capitalize">
              {onboardingData.riskTolerance ? onboardingData.riskTolerance.split('-').join(' ') : 'Not specified'}
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
          <div className="flex items-center text-gold">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-sm">
              {subscription?.expiresAt 
                ? `Active until ${new Date(subscription.expiresAt).toLocaleDateString()}` 
                : 'Free Tier'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
