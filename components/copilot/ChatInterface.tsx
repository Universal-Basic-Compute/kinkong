'use client';

import React from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { useChat } from '@/app/context/ChatContext';

export default function ChatInterface() {
  const { currentMission } = useChat();

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Mission indicator */}
      {currentMission && (
        <div className="absolute top-0 left-0 right-0 bg-gold/10 border-b border-gold/20 py-1 px-4 z-10">
          <p className="text-sm text-gold">
            <span className="font-semibold">Active Mission:</span> {currentMission}
          </p>
        </div>
      )}
      
      {/* Message list with auto-scrolling */}
      <MessageList />
      
      {/* Chat input with screenshot capability */}
      <ChatInput />
    </div>
  );
}
