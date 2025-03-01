import { formatDistanceToNow } from 'date-fns';

// Define transaction types
export interface WalletTransaction {
  txHash: string;
  blockTime: number; // Unix timestamp
  status: 'Success' | 'Fail';
  fee: number;
  actions: TransactionAction[];
}

export interface TransactionAction {
  actionType: 'Swap' | 'Transfer' | 'Mint' | 'Burn' | 'Stake' | 'Unstake' | string;
  info: {
    sender?: string;
    recipient?: string;
    amount?: number;
    amountUsd?: number;
    tokenIn?: string;
    tokenOut?: string;
    amountIn?: number;
    amountOut?: number;
    amountInUsd?: number;
    amountOutUsd?: number;
    [key: string]: any;
  };
}

// Define analysis result interface
export interface WalletAnalysisResult {
  investedAmount: number;
  withdrawnAmount: number;
  investor7dFlow: number;
  netSwapResult: number;
  pnlPercentage: number;
  recentTransactions: {
    type: 'Investment' | 'Withdrawal' | 'Swap';
    token: string;
    amount: number;
    amountUsd: number;
    timestamp: number;
    timeAgo: string;
    txHash: string;
  }[];
}

// Constants for investment thresholds
const INVESTMENT_THRESHOLDS = {
  UBC: 100000,
  COMPUTE: 1000000,
  USDC: 500
};

// Function to fetch transaction history from Birdeye API
export async function fetchWalletTransactions(wallet: string, limit: number = 100): Promise<WalletTransaction[]> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_BIRDEYE_API_KEY || process.env.BIRDEYE_API_KEY;
    
    if (!apiKey) {
      console.error('Birdeye API key not found');
      throw new Error('API key missing');
    }
    
    const response = await fetch(`https://public-api.birdeye.so/v1/wallet/tx_list?wallet=${wallet}&limit=${limit}`, {
      headers: {
        'x-api-key': apiKey,
        'x-chain': 'solana'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Birdeye API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data && Array.isArray(data.data.items)) {
      return data.data.items;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    throw error;
  }
}

// Function to analyze wallet transactions
export function analyzeWalletTransactions(transactions: WalletTransaction[]): WalletAnalysisResult {
  // Initialize result
  const result: WalletAnalysisResult = {
    investedAmount: 0,
    withdrawnAmount: 0,
    investor7dFlow: 0,
    netSwapResult: 0,
    pnlPercentage: 0,
    recentTransactions: []
  };
  
  // Get timestamp for 7 days ago
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  // Process each transaction
  transactions.forEach(tx => {
    // Skip failed transactions
    if (tx.status !== 'Success') return;
    
    // Process each action in the transaction
    tx.actions.forEach(action => {
      // Handle transfers (potential investments/withdrawals)
      if (action.actionType === 'Transfer') {
        const { sender, recipient, amount, amountUsd } = action.info;
        const token = action.info.token || '';
        
        // Skip if missing critical info
        if (!sender || !recipient || !amount || !token) return;
        
        // Check if this is a significant transfer (potential investment/withdrawal)
        const isSignificantAmount = 
          (token === 'UBC' && amount >= INVESTMENT_THRESHOLDS.UBC) ||
          (token === 'COMPUTE' && amount >= INVESTMENT_THRESHOLDS.COMPUTE) ||
          (token === 'USDC' && amount >= INVESTMENT_THRESHOLDS.USDC);
        
        if (isSignificantAmount) {
          const usdValue = amountUsd || 0;
          
          // If wallet is recipient, it's an investment
          if (recipient.toLowerCase() === wallet.toLowerCase()) {
            result.investedAmount += usdValue;
            
            // Check if within last 7 days
            if (tx.blockTime * 1000 >= sevenDaysAgo) {
              result.investor7dFlow += usdValue;
            }
            
            // Add to recent transactions
            result.recentTransactions.push({
              type: 'Investment',
              token,
              amount,
              amountUsd: usdValue,
              timestamp: tx.blockTime,
              timeAgo: formatDistanceToNow(new Date(tx.blockTime * 1000), { addSuffix: true }),
              txHash: tx.txHash
            });
          }
          // If wallet is sender, it's a withdrawal
          else if (sender.toLowerCase() === wallet.toLowerCase()) {
            result.withdrawnAmount += usdValue;
            
            // Check if within last 7 days
            if (tx.blockTime * 1000 >= sevenDaysAgo) {
              result.investor7dFlow -= usdValue;
            }
            
            // Add to recent transactions
            result.recentTransactions.push({
              type: 'Withdrawal',
              token,
              amount,
              amountUsd: usdValue,
              timestamp: tx.blockTime,
              timeAgo: formatDistanceToNow(new Date(tx.blockTime * 1000), { addSuffix: true }),
              txHash: tx.txHash
            });
          }
        }
      }
      
      // Handle swaps (for net result calculation)
      else if (action.actionType === 'Swap') {
        const { tokenIn, tokenOut, amountInUsd, amountOutUsd } = action.info;
        
        // Skip if missing critical info
        if (!tokenIn || !tokenOut || amountInUsd === undefined || amountOutUsd === undefined) return;
        
        // Calculate profit/loss from this swap
        const swapResult = amountOutUsd - amountInUsd;
        result.netSwapResult += swapResult;
        
        // Add to recent transactions
        result.recentTransactions.push({
          type: 'Swap',
          token: `${tokenIn} → ${tokenOut}`,
          amount: action.info.amountIn || 0,
          amountUsd: amountInUsd,
          timestamp: tx.blockTime,
          timeAgo: formatDistanceToNow(new Date(tx.blockTime * 1000), { addSuffix: true }),
          txHash: tx.txHash
        });
      }
    });
  });
  
  // Calculate PnL percentage
  if (result.investedAmount > 0) {
    // Net result = (current value + withdrawn) - invested
    // For simplicity, we're using netSwapResult as a proxy for current value change
    const netResult = result.netSwapResult + result.withdrawnAmount - result.investedAmount;
    result.pnlPercentage = (netResult / result.investedAmount) * 100;
  }
  
  // Sort recent transactions by timestamp (newest first)
  result.recentTransactions.sort((a, b) => b.timestamp - a.timestamp);
  
  return result;
}

// Main function to get wallet analysis
export async function getWalletAnalysis(wallet: string): Promise<WalletAnalysisResult> {
  try {
    // Fetch transactions
    const transactions = await fetchWalletTransactions(wallet, 500); // Get up to 500 transactions
    
    // Analyze transactions
    return analyzeWalletTransactions(transactions);
  } catch (error) {
    console.error('Error analyzing wallet:', error);
    // Return empty result on error
    return {
      investedAmount: 0,
      withdrawnAmount: 0,
      investor7dFlow: 0,
      netSwapResult: 0,
      pnlPercentage: 0,
      recentTransactions: []
    };
  }
}
