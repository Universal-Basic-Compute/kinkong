import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getTokenPrice } from '@/backend/src/utils/prices';

export interface TokenPosition {
  mint: string;
  balance: number;
  price: number;
  usdValue: number;
  percentage?: number;
}

export interface Portfolio {
  [mint: string]: TokenPosition;
}

export async function getCurrentPortfolio(
  connection: Connection,
  wallet: PublicKey
): Promise<Portfolio> {
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet, {
    programId: TOKEN_PROGRAM_ID
  });

  const portfolio: Portfolio = {};
  
  for (const account of tokenAccounts.value) {
    const mint = account.account.data.parsed.info.mint;
    const balance = account.account.data.parsed.info.tokenAmount.uiAmount;
    
    try {
      const price = await getTokenPrice(mint);
      portfolio[mint] = {
        mint,
        balance,
        price,
        usdValue: balance * price
      };
    } catch (error) {
      console.error(`Failed to get price for token ${mint}:`, error);
    }
  }

  return portfolio;
}

export function calculateCurrentAllocations(portfolio: Portfolio): TokenPosition[] {
  const totalValue = Object.values(portfolio)
    .reduce((sum, token) => sum + token.usdValue, 0);

  return Object.values(portfolio).map(token => ({
    ...token,
    percentage: (token.usdValue / totalValue) * 100
  }));
}

export interface Trade {
  token: string;
  action: 'BUY' | 'SELL';
  amount: number;
  currentUsd: number;
  targetUsd: number;
}

export async function planTrades(
  actualPortfolio: Portfolio,
  targetAllocations: Record<string, { percentage: number }>
): Promise<Trade[]> {
  const trades: Trade[] = [];
  const totalValue = Object.values(actualPortfolio)
    .reduce((sum, token) => sum + token.usdValue, 0);

  console.log('[Portfolio] Total Value:', totalValue);
  console.log('[Portfolio] Current Allocations:', 
    Object.entries(actualPortfolio)
      .map(([mint, data]) => `${mint}: ${(data.usdValue / totalValue * 100).toFixed(2)}%`)
  );

  for (const [token, target] of Object.entries(targetAllocations)) {
    const current = actualPortfolio[token] || { 
      balance: 0, 
      usdValue: 0,
      price: 0,
      mint: token 
    };
    
    const targetUsd = totalValue * (target.percentage / 100);
    
    // Only trade if difference is more than 3%
    if (Math.abs(current.usdValue - targetUsd) > totalValue * 0.03) {
      trades.push({
        token,
        action: current.usdValue < targetUsd ? 'BUY' : 'SELL',
        amount: Math.abs(targetUsd - current.usdValue) / current.price,
        currentUsd: current.usdValue,
        targetUsd
      });
    }
  }

  console.log('[Portfolio] Planned Trades:', trades);
  return trades;
}
