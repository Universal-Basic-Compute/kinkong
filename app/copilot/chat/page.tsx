'use client';

import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { verifySubscription } from '@/utils/subscription';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function CopilotChatPage() {
  const { publicKey, connected } = useWallet();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{active: boolean; expiresAt?: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkSubscription();
  }, [publicKey]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function checkSubscription() {
    if (!publicKey) {
      setSubscription(null);
      return;
    }

    try {
      const result = await verifySubscription(publicKey.toString());
      setSubscription(result);
    } catch (err) {
      console.error('Error checking subscription:', err);
      setSubscription(null);
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessage]);
      setInput('');

      // Get copilot response
      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: input,
          wallet: publicKey.toString()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      const data = await response.json();

      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-gray-400">
            Please connect your wallet to use KinKong Copilot
          </p>
        </div>
      </div>
    );
  }

  if (subscription && !subscription.active) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Subscription Required</h1>
          <p className="text-gray-400 mb-4">
            You need an active subscription to use KinKong Copilot
          </p>
          <a
            href="/copilot"
            className="inline-block bg-gold hover:bg-gold/80 text-black font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
          >
            Subscribe Now
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-black/50 border border-gold/20 rounded-lg h-[600px] flex flex-col">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-gold/10 text-gold'
                      : 'bg-gray-800/50 text-gray-200'
                  }`}
                >
                  <ReactMarkdown className="prose prose-invert">
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="border-t border-gold/20 p-4">
            {error && (
              <div className="text-red-400 text-sm mb-2">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder="Ask KinKong Copilot..."
                className="flex-1 bg-black/30 border border-gold/20 rounded-lg px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gold"
              />
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
