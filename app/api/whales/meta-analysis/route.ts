import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Initialize Airtable
const base = new Airtable({ 
  apiKey: process.env.KINKONG_AIRTABLE_API_KEY as string 
}).base(process.env.KINKONG_AIRTABLE_BASE_ID as string);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token') || 'ALL';
    const timeframe = searchParams.get('timeframe') || '7d';
    
    // Fetch the pre-generated meta-analysis from Airtable
    const metaAnalysisTable = base.table('WHALE_META_ANALYSIS');
    
    // Build filter formula to get the most recent meta-analysis for this token and timeframe
    const filterFormula = `AND({token}='${token}', {timeframe}='${timeframe}')`;
    
    const records = await metaAnalysisTable
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'createdAt', direction: 'desc' }],
        maxRecords: 1
      })
      .all();
    
    // If we have a meta-analysis, return it
    if (records.length > 0) {
      const metaAnalysis = records[0].fields;
      
      // Transform the string fields back to arrays
      const keyPatterns = metaAnalysis.keyPatterns ? 
        metaAnalysis.keyPatterns.toString().split('\n') : [];
      
      const actionableInsights = metaAnalysis.actionableInsights ? 
        metaAnalysis.actionableInsights.toString().split('\n') : [];
      
      const riskFactors = metaAnalysis.riskFactors ? 
        metaAnalysis.riskFactors.toString().split('\n') : [];
      
      // Format the analysis in the expected structure
      const analysis = {
        summary: metaAnalysis.summary || "",
        sentiment: metaAnalysis.sentiment || "NEUTRAL",
        confidenceScore: Number(metaAnalysis.confidenceScore) || 50,
        priceOutlook: metaAnalysis.priceOutlook || "",
        keyPatterns: keyPatterns,
        actionableInsights: actionableInsights,
        riskAssessment: metaAnalysis.riskAssessment || "MEDIUM",
        riskFactors: riskFactors,
        detailedAnalysis: metaAnalysis.detailedAnalysis || "",
        recommendedStrategy: metaAnalysis.recommendedStrategy || "HOLD"
      };
      
      // Also fetch the metrics for this token and timeframe
      const whaleAnalysisTable = base.table('WHALE_ANALYSIS');
      
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
      
      // Build filter formula for whale analysis
      let whaleFilterFormula = `IS_AFTER({createdAt}, '${startDateStr}')`;
      
      if (token !== 'ALL') {
        whaleFilterFormula = `AND(${whaleFilterFormula}, {token}='${token}')`;
      }
      
      const whaleRecords = await whaleAnalysisTable
        .select({
          filterByFormula: whaleFilterFormula
        })
        .all();
      
      const whaleData = whaleRecords.map(record => ({
        id: record.id,
        ...record.fields
      }));
      
      // Calculate metrics
      const totalWhales = whaleData.length;
      const bullish = whaleData.filter(item => item.outlook === 'BULLISH').length;
      const bearish = whaleData.filter(item => item.outlook === 'BEARISH').length;
      const neutral = whaleData.filter(item => item.outlook === 'NEUTRAL').length;
      
      const bullishPercentage = totalWhales > 0 ? (bullish / totalWhales) * 100 : 0;
      const bearishPercentage = totalWhales > 0 ? (bearish / totalWhales) * 100 : 0;
      const neutralPercentage = totalWhales > 0 ? (neutral / totalWhales) * 100 : 0;
      
      const accumulation = whaleData.filter(item => item.holdingPattern === 'ACCUMULATION').length;
      const distribution = whaleData.filter(item => item.holdingPattern === 'DISTRIBUTION').length;
      const holding = whaleData.filter(item => item.holdingPattern === 'HOLDING').length;
      
      const accumulationPercentage = totalWhales > 0 ? (accumulation / totalWhales) * 100 : 0;
      const distributionPercentage = totalWhales > 0 ? (distribution / totalWhales) * 100 : 0;
      const holdingPercentage = totalWhales > 0 ? (holding / totalWhales) * 100 : 0;
      
      const highActivity = whaleData.filter(item => item.tradingActivity === 'HIGH').length;
      const mediumActivity = whaleData.filter(item => item.tradingActivity === 'MEDIUM').length;
      const lowActivity = whaleData.filter(item => item.tradingActivity === 'LOW').length;
      
      const highActivityPercentage = totalWhales > 0 ? (highActivity / totalWhales) * 100 : 0;
      const mediumActivityPercentage = totalWhales > 0 ? (mediumActivity / totalWhales) * 100 : 0;
      const lowActivityPercentage = totalWhales > 0 ? (lowActivity / totalWhales) * 100 : 0;
      
      const confidenceSum = whaleData.reduce((sum, item) => sum + (Number(item.confidenceScore) || 0), 0);
      const avgConfidence = totalWhales > 0 ? confidenceSum / totalWhales : 0;
      
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
          mediumActivityPercentage,
          lowActivityPercentage,
          avgConfidence
        },
        lastUpdated: metaAnalysis.createdAt
      });
    } else {
      // If no meta-analysis is found, return a message indicating it's not available
      return NextResponse.json({
        token,
        timeframe,
        analysis: null,
        message: "No meta-analysis available for this token and timeframe. Analysis is generated periodically by the backend system."
      });
    }
    
  } catch (error) {
    console.error('Error fetching meta-analysis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meta-analysis' },
      { status: 500 }
    );
  }
}
