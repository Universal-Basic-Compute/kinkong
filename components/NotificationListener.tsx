'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NotificationListener() {
  const [connected, setConnected] = useState(false);
  const [lastSignal, setLastSignal] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Generate or retrieve client ID
    let clientId = localStorage.getItem('notificationClientId');
    if (!clientId) {
      clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('notificationClientId', clientId);
    }

    console.log(`Setting up notification listener with client ID: ${clientId}`);
    
    // Connect to SSE with client ID
    const eventSource = new EventSource(`/api/notifications/stream?clientId=${clientId}`);
    
    eventSource.onopen = () => {
      console.log('SSE connection opened');
      setConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Notification received:', data);
        
        // Handle different notification types
        if (data.type === 'SERVER_PUSH') {
          const notification = data.data;
          setLastSignal(notification.data);
          
          // Show browser notification if supported
          if (typeof Notification !== 'undefined' && 
              Notification.permission === 'granted') {
            new Notification(`${notification.data.token} Signal`, {
              body: `${notification.data.direction} ${notification.data.timeframe} - ${notification.data.reason?.substring(0, 100)}...`,
              icon: '/logo.png'
            });
          }
        }
      } catch (err) {
        console.error('Error processing notification:', err);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setConnected(false);
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        console.log('Attempting to reconnect SSE...');
        eventSource.close();
        
        // Poll for latest signal as a fallback
        fetchLatestSignal();
      }, 5000);
    };
    
    // Request notification permission if not already granted
    if (typeof Notification !== 'undefined' && 
        Notification.permission !== 'granted' && 
        Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
    
    // Poll for latest signal every 5 minutes as a backup
    const pollInterval = setInterval(fetchLatestSignal, 300000);
    
    // Clean up on unmount
    return () => {
      console.log('Closing SSE connection');
      eventSource.close();
      clearInterval(pollInterval);
    };
  }, [router]);

  // Fallback polling function
  const fetchLatestSignal = async () => {
    try {
      console.log('[Signal Polling] Fetching latest signal...');
      
      // Get API key from localStorage if available
      const apiKey = localStorage.getItem('swarmApiKey');
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization if we have an API key
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch('/api/notifications/latest', {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`SwarmTrade API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Signal Polling] Latest signal:', data);
      
      if (data && data.data && (!lastSignal || data.data.id !== lastSignal.id)) {
        setLastSignal(data.data);
        
        // Show browser notification if supported
        if (typeof Notification !== 'undefined' && 
            Notification.permission === 'granted') {
          new Notification(`${data.data.token} Signal`, {
            body: `${data.data.direction} ${data.data.timeframe} - ${data.data.reason?.substring(0, 100)}...`,
            icon: '/logo.png'
          });
        }
      }
    } catch (error) {
      console.error('[Signal Polling]', error);
    }
  };

  return null; // This component doesn't render anything
}
