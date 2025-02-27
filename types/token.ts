export interface TokenInfo {
  token: string;
  name: string;
  mint: string;
  xAccount?: string;
  isActive: boolean;
  price: number;
  volume24h: number;
  liquidity: number;
  holderCount: number;
  priceTrend: number;
  volumeGrowth: number;
  website?: string;
  explanation?: string;
}
