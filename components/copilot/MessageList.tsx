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
      
      {/* Add typing indicator before first message if no messages yet */}
      {messages.length === 0 && (
        <div className="flex items-center space-x-1 ml-3 mt-6">
          <div className="w-2 h-2 bg-gold/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-gold/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-gold/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
