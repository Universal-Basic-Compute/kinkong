export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

// Known token metadata
const KNOWN_TOKENS: Record<string, { name: string; token: string; image?: string }> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    name: 'USD Coin',
    token: 'USDC',
    image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    name: 'USDT',
    token: 'USDT',
    image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png'
  },
  'So11111111111111111111111111111111111111112': {
    name: 'Solana',
    token: 'SOL',
    image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  },
  'B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo': {
    name: 'Compute',
    token: 'COMPUTE',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/compute.png'
  },
  '9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump': {
    name: 'UBC',
    token: 'UBC',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/ubc.png'
  },
  // Add the unknown tokens from your error message
  'E1v9Lu8Td29vGbYwnuwEGiEdtpH7zjWj9yEJ1o96ZYHS': {
    name: 'Arc Protocol',
    token: 'ARC',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/arc.png'
  },
  'EUMDAyooKXXwWGfAFJCF8kmeGN8ZhcxA23ro3c3ABXf3': {
    name: 'Swarms',
    token: 'SWARMS',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/swarms.png'
  },
  '7PJaqMP6CyvEbtyg4ACKTYTw5HBvqJUKXnad5XAKxQFc': {
    name: 'Swarms',
    token: 'SWARMS',
    image: 'https://dd.dexscreener.com/ds-data/tokens/solana/swarms.png'
  }
};

export async function GET() {
  try {
    // Get token metadata from TOKENS table
    const tokensTable = getTable('TOKENS');
    const tokenRecords = await tokensTable.select().all();
    
    // Create a map of mint address to token metadata
    const tokenMetadata: Record<string, any> = { ...KNOWN_TOKENS };
    
    // Add tokens from Airtable
    tokenRecords.forEach(record => {
      const mint = record.get('mint');
      const symbol = record.get('token');
      const name = record.get('name') || symbol;
      const image = record.get('logoUrl');
      
      if (mint && symbol) {
        tokenMetadata[mint] = {
          name: name,
          token: symbol,
          image: image || `https://dd.dexscreener.com/ds-data/tokens/solana/${symbol.toLowerCase()}.png`
        };
      }
    });
    
    return NextResponse.json(tokenMetadata);
    
  } catch (error) {
    console.error('Failed to fetch token metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token metadata' },
      { status: 500 }
    );
  }
}
