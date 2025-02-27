import { getTokenClass, formatTokenSymbol } from '@/components/utils/tokenUtils';
import React from 'react';

export interface TokenDisplayOptions {
  showSymbolPrefix?: boolean;  // Whether to show $ prefix
  linkToSolscan?: boolean;     // Whether to link to Solscan
  className?: string;          // Additional classes
}

export function TokenDisplay({ 
  token, 
  mint, 
  options = {} 
}: { 
  token: string; 
  mint?: string; 
  options?: TokenDisplayOptions 
}) {
  const { 
    showSymbolPrefix = true, 
    linkToSolscan = true,
    className = ''
  } = options;
  
  const formattedToken = showSymbolPrefix ? formatTokenSymbol(token) : token;
  const tokenClass = getTokenClass(token);
  
  if (linkToSolscan && mint) {
    return (
      <a 
        href={`https://solscan.io/token/${mint}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`font-medium ${tokenClass} ${className}`}
      >
        {formattedToken}
      </a>
    );
  }
  
  return (
    <span className={`font-medium ${tokenClass} ${className}`}>
      {formattedToken}
    </span>
  );
}

// Export the utility functions for backward compatibility
export { getTokenClass, formatTokenSymbol };
