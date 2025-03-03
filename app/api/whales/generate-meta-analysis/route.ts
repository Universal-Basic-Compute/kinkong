import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Airtable with proper type assertion
const base = new Airtable({ 
  apiKey: process.env.KINKONG_AIRTABLE_API_KEY as string 
}).base(process.env.KINKONG_AIRTABLE_BASE_ID as string);

// Initialize Anthropic client
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
let anthropic;
if (anthropicApiKey) {
  anthropic = new Anthropic({
    apiKey: anthropicApiKey,
  });
} else {
  console.error('ANTHROPIC_API_KEY is not defined');
}

export async function POST(request: NextRequest) {
  try {
    const { token, timeframe, wallet } = await request.json();
    
    // Validate required fields
    if (!token || !timeframe) {
      return NextResponse.json(
        { error: 'Token and timeframe are required' },
        { status: 400 }
      );
    }
    
    // Validate wallet (optional - can be used for subscription checks)
    if (wallet) {
      // Check if user has an active subscription
      const subscriptionsTable = base.table('SUBSCRIPTIONS');
      const now = new Date().toISOString();
      
      const subscriptions = await subscriptionsTable
        .select({
          filterByFormula: `AND({wallet}='${wallet}', LOWER({status})='active', {endDate} > '${now}')`
        })
        .firstPage();
      
      if (subscriptions.length === 0) {
        return NextResponse.json(
          { error: 'Active subscription required to generate analysis' },
          { status: 403 }
        );
      }
    }
    
    // Fetch whale analysis data
    let filterFormula = '';
    if (token !== 'ALL') {
      filterFormula = `{token}='${token}'`;
    } else {
      filterFormula = 'NOT({token}="")';
    }
    
    // Add timeframe filter based on createdAt
    let timeframeFilter = '';
    if (timeframe === '7d') {
      timeframeFilter = 'IS_AFTER({createdAt}, DATEADD(TODAY(), -7, "days"))';
    } else if (timeframe === '30d') {
      timeframeFilter = 'IS_AFTER({createdAt}, DATEADD(TODAY(), -30, "days"))';
    } else if (timeframe === '90d') {
      timeframeFilter = 'IS_AFTER({createdAt}, DATEADD(TODAY(), -90, "days"))';
    }
    
    if (timeframeFilter) {
      filterFormula = `AND(${filterFormula}, ${timeframeFilter})`;
    }
    
    const whaleAnalysisTable = base.table('WHALE_ANALYSIS');
    const records = await whaleAnalysisTable
      .select({
        filterByFormula: filterFormula
      })
      .all();
    
    if (records.length === 0) {
      return NextResponse.json(
        { error: 'No whale analysis data available for the specified token and timeframe' },
        { status: 404 }
      );
    }
    
    // Process the data for analysis
    const whaleData = records.map(record => record.fields);
    
    // Calculate metrics
    const totalWhales = whaleData.length;
    const bullish = whaleData.filter(item => item.outlook === 'BULLISH').length;
    const bearish = whaleData.filter(item => item.outlook === 'BEARISH').length;
    const neutral = whaleData.filter(item => item.outlook === 'NEUTRAL').length;
    
    const bullishPercentage = Math.round((bullish / totalWhales) * 100);
    const bearishPercentage = Math.round((bearish / totalWhales) * 100);
    const neutralPercentage = Math.round((neutral / totalWhales) * 100);
    
    const accumulation = whaleData.filter(item => item.holdingPattern === 'ACCUMULATION').length;
    const distribution = whaleData.filter(item => item.holdingPattern === 'DISTRIBUTION').length;
    const holding = whaleData.filter(item => item.holdingPattern === 'HOLDING').length;
    
    const accumulationPercentage = Math.round((accumulation / totalWhales) * 100);
    const distributionPercentage = Math.round((distribution / totalWhales) * 100);
    const holdingPercentage = Math.round((holding / totalWhales) * 100);
    
    const highActivity = whaleData.filter(item => item.tradingActivity === 'HIGH').length;
    const highActivityPercentage = Math.round((highActivity / totalWhales) * 100);
    
    const confidenceSum = whaleData.reduce((sum, item) => sum + (Number(item.confidenceScore) || 0), 0);
    const avgConfidence = Math.round(confidenceSum / totalWhales);
    
    // Generate analysis with AI
    const prompt = `
You are a cryptocurrency whale analysis expert. Analyze the following data about whale behavior for ${token !== 'ALL' ? token : 'all tokens'} over the ${timeframe} timeframe:

Total whales analyzed: ${totalWhales}
Bullish sentiment: ${bullishPercentage}%
Bearish sentiment: ${bearishPercentage}%
Neutral sentiment: ${neutralPercentage}%
Accumulation pattern: ${accumulationPercentage}%
Distribution pattern: ${distributionPercentage}%
Holding pattern: ${holdingPercentage}%
High trading activity: ${highActivityPercentage}%
Average confidence score: ${avgConfidence}/100

Based on this data, provide a comprehensive whale meta-analysis with the following components:

1. A brief 1-2 sentence summary of the overall analysis
2. The overall sentiment (BULLISH, NEUTRAL, or BEARISH)
3. A confidence score (0-100)
4. A brief price outlook based on whale behavior
5. 4-6 key patterns identified in whale behavior (as bullet points)
6. 3-5 actionable insights for traders (as bullet points)
7. A risk assessment (LOW, MEDIUM, or HIGH)
8. 2-3 risk factors to be aware of (as bullet points)
9. A detailed paragraph explaining the analysis
10. A recommended strategy (ACCUMULATE, HOLD, or REDUCE)

Format your response as a JSON object with the following structure:
{
  "summary": "Brief summary",
  "sentiment": "BULLISH|NEUTRAL|BEARISH",
  "confidenceScore": 75,
  "priceOutlook": "Price outlook text",
  "keyPatterns": "Pattern 1\\nPattern 2\\nPattern 3\\nPattern 4",
  "actionableInsights": "Insight 1\\nInsight 2\\nInsight 3",
  "riskAssessment": "LOW|MEDIUM|HIGH",
  "riskFactors": "Risk 1\\nRisk 2\\nRisk 3",
  "detailedAnalysis": "Detailed analysis paragraph",
  "recommendedStrategy": "ACCUMULATE|HOLD|REDUCE"
}

Ensure your analysis is data-driven, balanced, and provides valuable insights for traders.
`;

    if (!anthropic) {
      throw new Error('Anthropic client is not initialized');
    }

    // Use Claude API for analysis
    const message = await anthropic.messages.create({
      model: "claude-3-7-sonnet-latest",
      max_tokens: 4000,
      temperature: 0.7,
      system: "You are a cryptocurrency whale analysis expert.",
      messages: [
        { role: "user", content: prompt }
      ]
    });

    const aiResponse = message.content[0].text;
    
    if (!aiResponse) {
      throw new Error('Failed to generate AI analysis');
    }
    
    // Parse the AI response
    const aiAnalysis = JSON.parse(aiResponse);
    
    // Create the meta-analysis record
    const metaAnalysisTable = base.table('WHALE_META_ANALYSIS');
    const metaAnalysis = {
      token: token,
      timeframe: timeframe,
      createdAt: new Date().toISOString(),
      summary: aiAnalysis.summary,
      sentiment: aiAnalysis.sentiment,
      confidenceScore: aiAnalysis.confidenceScore,
      priceOutlook: aiAnalysis.priceOutlook,
      keyPatterns: aiAnalysis.keyPatterns,
      actionableInsights: aiAnalysis.actionableInsights,
      riskAssessment: aiAnalysis.riskAssessment,
      riskFactors: aiAnalysis.riskFactors,
      detailedAnalysis: aiAnalysis.detailedAnalysis,
      recommendedStrategy: aiAnalysis.recommendedStrategy,
      totalWhales: totalWhales,
      bullishPercentage: bullishPercentage,
      bearishPercentage: bearishPercentage,
      neutralPercentage: neutralPercentage,
      accumulationPercentage: accumulationPercentage,
      distributionPercentage: distributionPercentage,
      holdingPercentage: holdingPercentage,
      highActivityPercentage: highActivityPercentage,
      avgConfidence: avgConfidence
    };
    
    const record = await metaAnalysisTable.create([{ fields: metaAnalysis }]);
    
    return NextResponse.json({
      ...metaAnalysis,
      id: record[0].id
    });
    
  } catch (error) {
    console.error('Error generating whale meta-analysis:', error);
    return NextResponse.json(
      { error: 'Failed to generate whale meta-analysis' },
      { status: 500 }
    );
  }
}
