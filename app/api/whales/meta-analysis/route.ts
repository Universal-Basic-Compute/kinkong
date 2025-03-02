import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Airtable and Anthropic
const base = new Airtable({ 
  apiKey: process.env.KINKONG_AIRTABLE_API_KEY as string 
}).base(process.env.KINKONG_AIRTABLE_BASE_ID as string);

// Check if Anthropic API key exists
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicApiKey) {
  console.error('ANTHROPIC_API_KEY is not defined in environment variables');
}

const anthropic = new Anthropic({
  apiKey: anthropicApiKey as string,
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token') || 'ALL';
    const timeframe = searchParams.get('timeframe') || '7d';
    
    // Calculate date range based on timeframe
    const now = new Date();
    let startDate;
    
    switch (timeframe) {
      case '30d':
        startDate = new Date(now.setDate(now.getDate() - 30));
        break;
      case '90d':
        startDate = new Date(now.setDate(now.getDate() - 90));
        break;
      case '7d':
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
    }
    
    const startDateStr = startDate.toISOString().split('T')[0];
    
    // Build filter formula
    let filterFormula = `IS_AFTER({createdAt}, '${startDateStr}')`;
    
    if (token !== 'ALL') {
      filterFormula = `AND(${filterFormula}, {token}='${token}')`;
    }
    
    // Fetch data from WHALE_ANALYSIS table
    const whaleAnalysisTable = base.table('WHALE_ANALYSIS');
    const records = await whaleAnalysisTable
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .all();
    
    // Transform records to include ID and fields
    const whaleData = records.map(record => ({
      id: record.id,
      ...record.fields
    }));
    
    // Calculate metrics for the prompt
    const totalWhales = whaleData.length;
    const bullish = whaleData.filter(item => item.outlook === 'BULLISH').length;
    const bearish = whaleData.filter(item => item.outlook === 'BEARISH').length;
    const neutral = whaleData.filter(item => item.outlook === 'NEUTRAL').length;
    
    const bullishPercentage = (bullish / totalWhales) * 100;
    const bearishPercentage = (bearish / totalWhales) * 100;
    const neutralPercentage = (neutral / totalWhales) * 100;
    
    const accumulation = whaleData.filter(item => item.holdingPattern === 'ACCUMULATION').length;
    const distribution = whaleData.filter(item => item.holdingPattern === 'DISTRIBUTION').length;
    const holding = whaleData.filter(item => item.holdingPattern === 'HOLDING').length;
    
    const accumulationPercentage = (accumulation / totalWhales) * 100;
    const distributionPercentage = (distribution / totalWhales) * 100;
    const holdingPercentage = (holding / totalWhales) * 100;
    
    const highActivity = whaleData.filter(item => item.tradingActivity === 'HIGH').length;
    const mediumActivity = whaleData.filter(item => item.tradingActivity === 'MEDIUM').length;
    const lowActivity = whaleData.filter(item => item.tradingActivity === 'LOW').length;
    
    const highActivityPercentage = (highActivity / totalWhales) * 100;
    const mediumActivityPercentage = (mediumActivity / totalWhales) * 100;
    const lowActivityPercentage = (lowActivity / totalWhales) * 100;
    
    const confidenceSum = whaleData.reduce((sum, item) => sum + (Number(item.confidenceScore) || 0), 0);
    const avgConfidence = confidenceSum / totalWhales;
    
    // If no data, return empty analysis
    if (whaleData.length === 0) {
      return NextResponse.json({
        token,
        timeframe,
        analysis: "Insufficient data for meta-analysis",
        metrics: {
          totalWhales: 0,
          bullishPercentage: 0,
          bearishPercentage: 0,
          neutralPercentage: 0,
          accumulationPercentage: 0,
          distributionPercentage: 0,
          holdingPercentage: 0,
          highActivityPercentage: 0,
          avgConfidence: 0
        }
      });
    }
    
    // Create a prompt for Claude to analyze the data
    const prompt = `
    You are a cryptocurrency analyst specializing in whale behavior analysis. Analyze the following aggregated data about whale behavior for ${token === 'ALL' ? 'all tokens' : token} over the past ${timeframe === '7d' ? '7 days' : timeframe === '30d' ? '30 days' : '90 days'}.

    Whale Metrics:
    - Total Whales Analyzed: ${totalWhales}
    - Sentiment: ${bullishPercentage.toFixed(1)}% Bullish, ${bearishPercentage.toFixed(1)}% Bearish, ${neutralPercentage.toFixed(1)}% Neutral
    - Holding Patterns: ${accumulationPercentage.toFixed(1)}% Accumulation, ${distributionPercentage.toFixed(1)}% Distribution, ${holdingPercentage.toFixed(1)}% Holding
    - Trading Activity: ${highActivityPercentage.toFixed(1)}% High, ${mediumActivityPercentage.toFixed(1)}% Medium, ${lowActivityPercentage.toFixed(1)}% Low
    - Average Confidence Score: ${avgConfidence.toFixed(1)}/100

    ${token !== 'ALL' ? `
    Additional Token-Specific Data:
    - Token: ${token}
    - Number of Whales: ${totalWhales}
    - Top Whale Holdings: ${whaleData.slice(0, 3).map(w => `${Number(w.holdingAmount).toLocaleString()} ${token}`).join(', ')}
    ` : ''}

    Provide a comprehensive meta-analysis of whale behavior based on this data. Include:
    1. Overall market sentiment interpretation
    2. Likely price direction based on whale behavior
    3. Key patterns or trends identified
    4. Actionable insights for traders
    5. Risk assessment (low/medium/high)

    Format your response as JSON with the following structure:
    {
      "summary": "Brief 1-2 sentence summary of the analysis",
      "sentiment": "BULLISH/NEUTRAL/BEARISH",
      "confidenceScore": 0-100,
      "priceOutlook": "Brief price prediction based on whale behavior",
      "keyPatterns": ["Pattern 1", "Pattern 2", "Pattern 3"],
      "actionableInsights": ["Insight 1", "Insight 2", "Insight 3"],
      "riskAssessment": "LOW/MEDIUM/HIGH",
      "riskFactors": ["Factor 1", "Factor 2"],
      "detailedAnalysis": "Detailed paragraph explaining the analysis",
      "recommendedStrategy": "ACCUMULATE/HOLD/REDUCE"
    }
    `;
    
    // Call Claude API for analysis
    let responseText;
    try {
      const message = await anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 4000,
        temperature: 0.2,
        system: "You are a cryptocurrency analyst specializing in whale behavior analysis. Provide concise, data-driven insights.",
        messages: [
          { role: "user", content: prompt }
        ]
      });
      
      // Extract JSON from Claude's response
      responseText = message.content[0].text;
    } catch (error) {
      console.error('Error calling Claude API:', error);
      return NextResponse.json(
        { error: 'Failed to generate analysis with Claude' },
        { status: 500 }
      );
    }
    
    // If we get here, we have a valid response
    const responseText = message.content[0].text;
    
    // Find JSON in the response
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}') + 1;
    
    let analysis = {};
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const jsonStr = responseText.substring(jsonStart, jsonEnd);
      try {
        analysis = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse JSON from Claude response");
        analysis = { error: "Failed to parse analysis" };
      }
    } else {
      analysis = { error: "No valid JSON found in analysis" };
    }
    
    // Return the meta-analysis along with the metrics
    return NextResponse.json({
      token,
      timeframe,
      analysis,
      metrics: {
        totalWhales,
        bullishPercentage,
        bearishPercentage,
        neutralPercentage,
        accumulationPercentage,
        distributionPercentage,
        holdingPercentage,
        highActivityPercentage,
        avgConfidence
      }
    });
    
  } catch (error) {
    console.error('Error generating meta-analysis:', error);
    return NextResponse.json(
      { error: 'Failed to generate meta-analysis' },
      { status: 500 }
    );
  }
}
