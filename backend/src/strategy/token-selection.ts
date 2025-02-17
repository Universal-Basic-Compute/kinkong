import { getTable } from '../airtable/tables';
import type { Token } from '../airtable/tables';

interface TokenMetrics {
  symbol: string;
  mint: string;
  volume7d: number;
  liquidity: number;
  volumeGrowth: number;
  pricePerformance: number;
  holderCount: number;
  score: number;
}

const MINIMUM_REQUIREMENTS = {
  dailyVolume: 10000, // $10k minimum daily volume
  liquidity: 30000,   // $30k minimum liquidity (3x intended $10k position)
};

export async function selectInitialTokens(): Promise<TokenMetrics[]> {
  try {
    // 1. Get all potential AI tokens from our TOKENS table
    const table = getTable('TOKENS');
    const records = await table
      .select({
        filterByFormula: 'AND({isActive} = 1, {volume7d} > 0)',
        sort: [{ field: 'volume7d', direction: 'desc' }]
      })
      .all();

    // 2. Filter and score tokens
    const tokens: TokenMetrics[] = records
      .map(record => ({
        symbol: record.get('symbol') as string,
        mint: record.get('mint') as string,
        volume7d: record.get('volume7d') as number,
        liquidity: record.get('liquidity') as number,
        volumeGrowth: record.get('volumeGrowth') as number || 0,
        pricePerformance: record.get('pricePerformance') as number || 0,
        holderCount: record.get('holderCount') as number || 0,
        score: 0 // Will be calculated
      }))
      .filter(token => 
        // Apply minimum requirements
        (token.volume7d / 7) >= MINIMUM_REQUIREMENTS.dailyVolume &&
        token.liquidity >= MINIMUM_REQUIREMENTS.liquidity
      );

    // 3. Score tokens
    const scoredTokens = tokens.map(token => {
      // Normalize metrics to 0-100 scale
      const volumeScore = normalizeScore(token.volume7d, tokens.map(t => t.volume7d));
      const liquidityScore = normalizeScore(token.liquidity, tokens.map(t => t.liquidity));
      const growthScore = normalizeScore(token.volumeGrowth, tokens.map(t => t.volumeGrowth));
      const performanceScore = normalizeScore(token.pricePerformance, tokens.map(t => t.pricePerformance));
      const holderScore = normalizeScore(token.holderCount, tokens.map(t => t.holderCount));

      // Weight the scores
      const score = (
        volumeScore * 0.3 +      // 30% weight on volume
        liquidityScore * 0.3 +    // 30% weight on liquidity
        growthScore * 0.2 +       // 20% weight on volume growth
        performanceScore * 0.1 +  // 10% weight on price performance
        holderScore * 0.1         // 10% weight on holder count
      );

      return {
        ...token,
        score
      };
    });

    // 4. Sort by score and take top 10
    const selectedTokens = scoredTokens
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // 5. Record selections in PORTFOLIO table
    const portfolioTable = getTable('PORTFOLIO');
    await Promise.all(selectedTokens.map(token => 
      portfolioTable.create([{
        fields: {
          token: token.symbol,
          mint: token.mint,
          allocation: 0, // Initial allocation will be set by portfolio manager
          lastUpdate: new Date().toISOString(),
          isActive: true
        }
      }])
    ));

    return selectedTokens;
  } catch (error) {
    console.error('Error selecting initial tokens:', error);
    throw error;
  }
}

// Helper function to normalize scores to 0-100 scale
function normalizeScore(value: number, allValues: number[]): number {
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  if (max === min) return 50; // Default to middle if all values are the same
  return ((value - min) / (max - min)) * 100;
}

// Function to get current token selections
export async function getCurrentTokens(): Promise<string[]> {
  const table = getTable('PORTFOLIO');
  const records = await table
    .select({
      filterByFormula: '{isActive} = 1'
    })
    .all();

  return records.map(record => record.get('token') as string);
}

// Function to check if token meets minimum requirements
export async function meetsRequirements(token: Token): Promise<boolean> {
  return (
    token.volume7d / 7 >= MINIMUM_REQUIREMENTS.dailyVolume &&
    token.liquidity >= MINIMUM_REQUIREMENTS.liquidity
  );
}
