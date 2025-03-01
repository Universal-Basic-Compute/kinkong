'use client';

import React from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

export default function ChatInterface() {
  return (
    <div className="flex-1 flex flex-col">
      <MessageList />
      <ChatInput />
    </div>
  );
}
