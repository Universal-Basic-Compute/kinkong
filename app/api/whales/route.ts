import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.KINKONG_AIRTABLE_API_KEY }).base(
  process.env.KINKONG_AIRTABLE_BASE_ID as string
);

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
    const records = await base('WHALE_ANALYSIS')
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
    
    return NextResponse.json(whaleData);
  } catch (error) {
    console.error('Error fetching whale data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch whale data' },
      { status: 500 }
    );
  }
}
