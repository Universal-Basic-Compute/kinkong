import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';
import { getInvestments } from '@/backend/src/airtable/investments';

export async function GET(request: NextRequest) {
  try {
    // Use the getInvestments function from the backend
    const investments = await getInvestments();
    
    // Get the redistributions to add return data
    const redistributionsTable = getTable('INVESTOR_REDISTRIBUTIONS');
    const redistributionsRecords = await redistributionsTable.select({
      maxRecords: 100,
      sort: [{ field: 'createdAt', direction: 'desc' }]
    }).all();
    
    // Create a map of investmentId to redistribution data
    const redistributionMap = new Map();
    redistributionsRecords.forEach(record => {
      const investmentId = record.get('investmentId');
      if (investmentId) {
        redistributionMap.set(investmentId, {
          ubcReturn: parseFloat(record.get('ubcAmount') || '0'),
          return: parseFloat(record.get('amount') || '0'),
          redistributionId: record.get('redistributionId') || record.id,
          redistributionDate: record.get('createdAt'),
          percentage: parseFloat(record.get('percentage') || '0'),
          claimed: record.get('claimed') || false
        });
      }
    });
    
    // Combine investment data with redistribution data
    const combinedData = investments.map(investment => {
      const redistribution = redistributionMap.get(investment.investmentId) || {};
      
      // Log the wallet addresses to debug
      console.log(`Investment ${investment.investmentId}:`, {
        investmentWallet: investment.wallet,
        redistributionWallet: redistribution.wallet || 'N/A'
      });
      
      return {
        ...investment,
        ...redistribution
      };
    });
    
    console.log(`Returning ${combinedData.length} investments with redistribution data`);
    return NextResponse.json(combinedData);
  } catch (error) {
    console.error('Error fetching redistributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch redistributions' },
      { status: 500 }
    );
  }
}
