'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import { useChat } from '@/app/context/ChatContext';

export default function MessageList() {
  const { 
    messages, 
    typingMessage, 
    displayedParagraphs, 
    isTyping,
    messagesEndRef
  } = useChat();

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-0">
      <AnimatePresence>
        {messages.map((message, index) => (
          <MessageBubble
            key={index}
            message={message}
            index={index}
            isLastMessage={index === messages.length - 1}
            typingMessage={typingMessage}
            displayedParagraphs={displayedParagraphs}
            isTyping={isTyping}
          />
        ))}
      </AnimatePresence>
      
      {/* Add welcome message if no messages yet */}
      {messages.length === 0 && (
        <div className="text-center py-8">
          <h3 className="text-xl font-semibold text-gold mb-2">Welcome to KinKong Copilot</h3>
          <p className="text-gray-300 max-w-md mx-auto">
            Ask me anything about trading, token analysis, or portfolio management. 
            Select a mission from the sidebar to get specialized assistance.
          </p>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
