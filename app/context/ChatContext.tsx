'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { askKinKongCopilot } from '@/utils/copilot';
import { useWallet } from '@solana/wallet-adapter-react';
import { verifySubscription } from '@/utils/subscription';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  screenshot?: string;
  paragraphs?: string[];
}

interface UserData {
  experience: string;
  interests: string[];
  incomeSource: string;
  riskTolerance: string;
}

interface ChatContextType {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  error: string | null;
  screenshot: string | null;
  setScreenshot: (screenshot: string | null) => void;
  isCapturing: boolean;
  typingMessage: string | null;
  displayedParagraphs: string[];
  isTyping: boolean;
  subscription: { active: boolean; expiresAt?: string } | null;
  currentMission: string | null;
  setCurrentMission: (mission: string | null) => void;
  currentSubmission: string | null;
  setCurrentSubmission: (submission: string | null) => void;
  selectedMissionId: string | null;
  setSelectedMissionId: (id: string | null) => void;
  userData: UserData | null;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  captureScreenshot: () => Promise<void>;
  clearScreenshot: () => void;
  scrollToBottom: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  handleSelectMission: (missionTitle: string, context: string, missionId: string, submissionId?: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode; code: string | null }> = ({ 
  children, 
  code 
}) => {
  const { publicKey } = useWallet();
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
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Function to fetch user data from Airtable
  const fetchUserData = async (walletAddress: string) => {
    try {
      console.log('Fetching user data for wallet:', walletAddress);
      const response = await fetch(`/api/users/get?wallet=${walletAddress}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      
      const data = await response.json();
      console.log('User data fetched:', data);
      
      if (data.user) {
        setUserData(data.user);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };


  // Define animateMessageTyping here, before any useEffect that references it
  const animateMessageTyping = useCallback((message: string, messageIndex: number) => {
    // Split message into paragraphs (by double newlines or markdown headers)
    // Also handle cases where a paragraph ends with a colon followed by a list
    const paragraphs = message.split(/\n\n|\n#{1,6} /);
    const cleanParagraphs = paragraphs.map(p => p.trim()).filter(p => p.length > 0);
    
    setTypingMessage(message);
    setDisplayedParagraphs([]);
    setIsTyping(true);
    
    // Store the paragraphs in the message object for later use
    setMessages(prevMessages => {
      const updatedMessages = [...prevMessages];
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        paragraphs: cleanParagraphs
      };
      return updatedMessages;
    });
    
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
      
      // Scroll to bottom after adding each new paragraph
      setTimeout(() => {
        scrollToBottom();
      }, 50); // Small delay to ensure DOM has updated
      
      // Calculate read time based on paragraph length - moderate speed
      const readTime = Math.max(500, cleanParagraphs[index].length * 20);
      
      // Schedule next paragraph
      setTimeout(() => showNextParagraph(index + 1), readTime);
    };
    
    // Start displaying paragraphs
    showNextParagraph(0);
  }, []);

  useEffect(() => {
    // Disable scrolling on the body when chat page is mounted
    document.body.classList.add('no-scroll');
    
    // Re-enable scrolling when component unmounts
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, []);

  useEffect(() => {
    checkSubscription();
    
    // If wallet is connected, fetch user data
    if (publicKey) {
      fetchUserData(publicKey.toString());
    }
    
    setLoading(false);
  }, [publicKey, code]);

  // Removed automatic greeting to let users initiate the conversation themselves

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Effect to fetch previous messages when wallet connects
  useEffect(() => {
    if (publicKey) {
      const walletAddress = publicKey.toString();
      fetchUserData(walletAddress);
      fetchPreviousMessages(walletAddress);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [publicKey]);

  // Function to fetch previous messages for a wallet
  const fetchPreviousMessages = async (walletAddress: string) => {
    try {
      console.log('Fetching previous messages for wallet:', walletAddress);
      const response = await fetch(`/api/messages/get?wallet=${walletAddress}&limit=20`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch previous messages');
      }
      
      const data = await response.json();
      console.log('Previous messages fetched:', data.messages?.length || 0);
      
      if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        // Convert the messages to our Message format
        const formattedMessages = data.messages.map((msg: any) => {
          // Process paragraphs for each message
          const content = msg.content || '';
          const paragraphs = content.split(/\n\n|\n#{1,6} /);
          const cleanParagraphs = paragraphs.map((p: string) => p.trim()).filter((p: string) => p.length > 0);
          
          return {
            role: msg.role,
            content: msg.content,
            timestamp: msg.createdAt || new Date().toISOString(),
            screenshot: msg.screenshot || undefined,
            paragraphs: cleanParagraphs.length > 0 ? cleanParagraphs : undefined
          };
        });
        
        // Set the messages directly without animation
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error fetching previous messages:', error);
    }
  };

  async function checkSubscription() {
    if (!code) {
      // Without a code, set subscription to inactive
      setSubscription({ active: false });
      return;
    }

    try {
      // Get the actual subscription status
      const result = await verifySubscription(code);
      // Use the actual result without overriding
      setSubscription(result);
      
      // Log the subscription status for debugging
      console.log('Subscription status:', result);
    } catch (err) {
      console.error('Error checking subscription:', err);
      // On error, set subscription to inactive
      setSubscription({ active: false });
    }
  }

  const handleSelectMission = (missionTitle: string, submissionTitle: string, missionId: string, submissionId?: string) => {
    // Store the mission ID for both context and UI highlighting
    setCurrentMission(missionId);
    setSelectedMissionId(missionId);
    setCurrentSubmission(submissionId || null);
    
    // Don't set the input field with the context anymore
    // setInput(context);
    
    // Scroll to the input field to keep the user's focus there
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const captureScreenshot = async () => {
    try {
      setIsCapturing(true);
      setError(null);
      
      // Use browser's screenshot API if available (Chrome extension only)
      if (window.navigator && 'mediaDevices' in navigator) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true
        });
        
        const track = stream.getVideoTracks()[0];
        
        // Create a video element and capture from that instead of using ImageCapture
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        
        // Create a canvas with the video dimensions
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);
        
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

      // We no longer need a separate timeout promise since it's handled in askKinKongCopilot
      const response = await askKinKongCopilot(
        input, 
        code || 'default', 
        walletAddress,
        screenshot || undefined,
        currentMission,
        currentSubmission
      );
    
      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Start typing animation with the index of the new message
      animateMessageTyping(response, messages.length + 1);
      
      // Clear screenshot after sending
      setScreenshot(null);

    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ChatContext.Provider value={{
      messages,
      input,
      setInput,
      isLoading,
      error,
      screenshot,
      setScreenshot,
      isCapturing,
      typingMessage,
      displayedParagraphs,
      isTyping,
      subscription,
      currentMission,
      setCurrentMission,
      currentSubmission,
      setCurrentSubmission,
      selectedMissionId,
      setSelectedMissionId,
      userData,
      handleSubmit,
      captureScreenshot,
      clearScreenshot,
      scrollToBottom,
      messagesEndRef,
      handleSelectMission
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
