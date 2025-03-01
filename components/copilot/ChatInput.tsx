'use client';

import React from 'react';
import { useChat } from '@/app/context/ChatContext';

export default function ChatInput() {
  const { 
    input, 
    setInput, 
    isLoading, 
    error, 
    screenshot, 
    isCapturing,
    handleSubmit,
    captureScreenshot,
    clearScreenshot
  } = useChat();

  return (
    <div className="border-t border-gold/20 p-4 bg-black/30 mt-auto">
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
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Allow new line with Shift+Enter, but submit with just Enter
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (input.trim() && !isLoading) {
                handleSubmit(e as unknown as React.FormEvent);
              }
            }
          }}
          disabled={isLoading}
          placeholder="Ask KinKong Copilot... (Shift+Enter for new line)"
          className="flex-1 bg-black/30 border border-gold/20 rounded-lg px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gold resize-none min-h-[52px] max-h-32 overflow-y-auto"
          rows={input.split('\n').length > 3 ? 3 : input.split('\n').length || 1}
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
  );
}
