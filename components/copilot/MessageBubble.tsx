'use client';

import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Message } from '@/app/context/ChatContext';

// Function to preprocess markdown content to fix spacing issues between paragraphs and lists
function preprocessMarkdown(content: string): string {
  // Replace any paragraph that ends with a colon followed by a list with a special marker
  let processed = content.replace(/(\w+:)\s*\n+(\s*[-*+]\s|\s*[0-9]+\.\s)/g, '$1 $2');
  
  // Replace any paragraph that ends with a colon followed by a newline with no newline
  processed = processed.replace(/(\w+:)\s*\n+/g, '$1 ');
  
  return processed;
}

interface MessageBubbleProps {
  message: Message;
  index: number;
  isLastMessage: boolean;
  typingMessage: string | null;
  displayedParagraphs: string[];
  isTyping: boolean;
}

export default function MessageBubble({
  message,
  index,
  isLastMessage,
  typingMessage,
  displayedParagraphs,
  isTyping
}: MessageBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0 }}
      className={`flex ${
        message.role === 'user' ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* For user messages */}
      {message.role === 'user' && (
        <div className="max-w-[80%] rounded-lg p-3 bg-gradient-to-r from-gold/20 to-amber-500/10 text-gold border border-gold/30">
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
          <ReactMarkdown 
            className="prose prose-invert break-words whitespace-pre-wrap"
            components={{
              p: ({node, children, ...props}) => {
                // @ts-ignore - node.next is available in practice
                const nextSibling = node.next;
                const isBeforeList = nextSibling && (nextSibling.type === 'element' && 
                  (nextSibling.tagName === 'ul' || nextSibling.tagName === 'ol'));
                
                return <p className={isBeforeList ? 'mb-0 pb-0' : ''} {...props}>{children}</p>;
              },
              ul: ({node, ...props}) => <ul className="mt-0 pt-0 mb-0 pb-0 pl-5" {...props} />,
              ol: ({node, ...props}) => <ol className="mt-0 pt-0 mb-0 pb-0 pl-5" {...props} />,
              li: ({node, children, ...props}) => <li className="my-0 py-0" {...props}>{children}</li>
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      )}
      
      {/* For assistant messages */}
      {message.role === 'assistant' && (
        <>
          {/* If this is the message currently being typed */}
          {typingMessage && isLastMessage ? (
            <div className="space-y-3 w-full">
              {/* Display paragraphs that have been revealed so far */}
              {displayedParagraphs.map((paragraph, pIndex) => (
                <motion.div 
                  key={pIndex} 
                  className="flex justify-start"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="max-w-[80%] rounded-lg p-3 bg-gradient-to-r from-gray-800/70 to-gray-700/40 text-gray-200 border border-gray-700/50">
                    <ReactMarkdown 
                      className="prose prose-invert break-words whitespace-pre-wrap"
                      components={{
                        ul: ({node, ...props}) => <ul className="my-1 pl-5" {...props} />,
                        ol: ({node, ...props}) => <ol className="my-1 pl-5" {...props} />,
                        li: ({node, ...props}) => <li className="my-0.5" {...props} />
                      }}
                    >
                      {paragraph}
                    </ReactMarkdown>
                  </div>
                </motion.div>
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
            /* For completed messages, display in multiple bubbles if paragraphs exist */
            message.paragraphs ? (
              <div className="space-y-3 w-full">
                {message.paragraphs.map((paragraph, pIndex) => (
                  <div key={pIndex} className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg p-3 bg-gradient-to-r from-gray-800/70 to-gray-700/40 text-gray-200 border border-gray-700/50">
                      <ReactMarkdown 
                        className="prose prose-invert break-words whitespace-pre-wrap"
                        components={{
                          p: ({node, children, ...props}) => {
                            // @ts-ignore - node.next is available in practice
                            const nextSibling = node.next;
                            const isBeforeList = nextSibling && (nextSibling.type === 'element' && 
                              (nextSibling.tagName === 'ul' || nextSibling.tagName === 'ol'));
                            
                            return <p className={isBeforeList ? 'mb-0 pb-0' : ''} {...props}>{children}</p>;
                          },
                          ul: ({node, ...props}) => <ul className="mt-0 pt-0 mb-0 pb-0 pl-5" {...props} />,
                          ol: ({node, ...props}) => <ol className="mt-0 pt-0 mb-0 pb-0 pl-5" {...props} />,
                          li: ({node, children, ...props}) => <li className="my-0 py-0" {...props}>{children}</li>
                        }}
                      >
                        {preprocessMarkdown(paragraph)}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Fallback for messages without paragraphs */
              <div className="max-w-[80%] rounded-lg p-3 bg-gradient-to-r from-gray-800/70 to-gray-700/40 text-gray-200 border border-gray-700/50">
                <ReactMarkdown 
                  className="prose prose-invert break-words whitespace-pre-wrap"
                  components={{
                    p: ({node, children, ...props}) => {
                      // @ts-ignore - node.next is available in practice
                      const nextSibling = node.next;
                      const isBeforeList = nextSibling && (nextSibling.type === 'element' && 
                        (nextSibling.tagName === 'ul' || nextSibling.tagName === 'ol'));
                    
                      return <p className={isBeforeList ? 'mb-0 pb-0' : ''} {...props}>{children}</p>;
                    },
                    ul: ({node, ...props}) => <ul className="mt-0 pt-0 mb-0 pb-0 pl-5" {...props} />,
                    ol: ({node, ...props}) => <ol className="mt-0 pt-0 mb-0 pb-0 pl-5" {...props} />,
                    li: ({node, children, ...props}) => <li className="my-0 py-0" {...props}>{children}</li>
                  }}
                >
                  {preprocessMarkdown(message.content)}
                </ReactMarkdown>
              </div>
            )
          )}
        </>
      )}
    </motion.div>
  );
}
