interface TokenData {
  token: string;
  metrics: {
    price: {
      current: number;
      high24h: number;
      low24h: number;
      change24h: number;
    };
    volume: {
      amount24h: number;
      previousDay: number;
      buyVsSell: number;
    };
    liquidity: {
      current: number;
      depth: {
        buy2percent: number;
        sell2percent: number;
      };
    };
  };
  chart: Buffer;
}

interface TradeSetup {
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  riskRewardRatio: number;
  confidence: number;
}

interface LLMResponse {
  setup: TradeSetup;
  reasoning: {
    marketStructure: string;
    volumeAnalysis: string;
    technicalLevels: string;
    keyRisks: string[];
  };
  tradingPlan: {
    entryReasoning: string;
    targetReasoning: string;
    stopLossReasoning: string;
  };
  metrics: {
    volume: {
      amount24h: number;
      previousDay: number;
      buyVsSell: number;
    };
    price: {
      current: number;
      high24h: number;
      low24h: number;
      change24h: number;
    };
    liquidity: {
      current: number;
      depth: {
        buy2percent: number;
        sell2percent: number;
      };
    };
  };
}

export async function analyzeTradingOpportunity(data: TokenData): Promise<LLMResponse> {
  const prompt = buildAnalysisPrompt(data);
  const response = await submitToLLM(prompt);
  const setup = validateAndParseResponse(response);
  
  if (!isValidSetup(setup)) {
    throw new Error('Invalid trade setup generated');
  }
  
  return setup;
}

function buildAnalysisPrompt(data: TokenData): string {
  return `
You are an expert crypto trader specializing in AI tokens on Solana.
Analyze this token and provide a detailed trading setup:

TOKEN: ${data.token}
METRICS:
${JSON.stringify(data.metrics, null, 2)}

CHART:
[chart_image_base64: ${data.chart.toString('base64')}]

Analyze the following:
1. Current market structure
2. Volume patterns
3. Support/resistance levels
4. Risk/reward ratio
5. Key technical levels

Provide a complete trading setup with:
1. Clear reasoning for the trade
2. Precise entry price
3. Target price with rationale
4. Stop loss with reasoning
5. Confidence level (0-100)

Format response as JSON:
{
  "setup": {
    "direction": "LONG|SHORT",
    "entryPrice": 0.00,
    "targetPrice": 0.00,
    "stopLoss": 0.00,
    "riskRewardRatio": 0.00,
    "confidence": 0-100
  },
  "reasoning": {
    "marketStructure": "explanation",
    "volumeAnalysis": "explanation",
    "technicalLevels": "explanation",
    "keyRisks": ["risk1", "risk2"]
  },
  "tradingPlan": {
    "entryReasoning": "why this entry",
    "targetReasoning": "why this target",
    "stopLossReasoning": "why this stop"
  }
}`;
}

function isValidSetup(setup: LLMResponse): boolean {
  const { confidence, riskRewardRatio } = setup.setup;
  
  return (
    confidence >= 80 &&
    riskRewardRatio >= 2 &&
    hasValidVolume(setup) &&
    hasValidLevels(setup)
  );
}

function hasValidVolume(setup: LLMResponse): boolean {
  // Minimum $50k 24h volume
  return setup.metrics.volume.amount24h >= 50000;
}

function hasValidLevels(setup: LLMResponse): boolean {
  const { entryPrice, targetPrice, stopLoss } = setup.setup;
  
  // Ensure we have reasonable price levels
  return (
    entryPrice > 0 &&
    targetPrice > 0 &&
    stopLoss > 0 &&
    targetPrice !== entryPrice &&
    stopLoss !== entryPrice
  );
}

async function submitToLLM(prompt: string) {
  // Implementation using your preferred LLM API
}

function validateAndParseResponse(response: any): LLMResponse {
  // Implementation to validate and parse LLM response
}

export function calculateSetupScore(setup: LLMResponse): number {
  const {
    confidence,
    riskRewardRatio
  } = setup.setup;

  const volumeScore = calculateVolumeScore(setup);
  const technicalScore = calculateTechnicalScore(setup);

  return (
    (confidence * 0.4) +
    (riskRewardRatio * 20) +
    (volumeScore * 0.2) +
    (technicalScore * 0.2)
  );
}

function calculateVolumeScore(setup: LLMResponse): number {
  const { amount24h, previousDay } = setup.metrics.volume;
  const volumeGrowth = (amount24h - previousDay) / previousDay;
  return Math.min(100, Math.max(0, 50 + volumeGrowth * 100));
}

function calculateTechnicalScore(setup: LLMResponse): number {
  // Score based on technical analysis quality
  const hasMarketStructure = setup.reasoning.marketStructure.length > 50;
  const hasDetailedLevels = setup.reasoning.technicalLevels.length > 50;
  const hasRisks = setup.reasoning.keyRisks.length >= 2;
  
  return (
    (hasMarketStructure ? 40 : 0) +
    (hasDetailedLevels ? 40 : 0) +
    (hasRisks ? 20 : 0)
  );
}
