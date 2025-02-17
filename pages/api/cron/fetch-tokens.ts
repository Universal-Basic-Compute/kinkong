import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';
import { getJupiterData } from '@/backend/src/collectors/jupiter';
import { getBirdeyeData } from '@/backend/src/collectors/birdeye';

export async function GET() {
  try {
    console.log('Starting token data collection...');
    
    // Collect market data from different sources
    const jupiterData = await getJupiterData();
    const birdeyeData = await getBirdeyeData();
    
    // Merge and process data
    const processedData = [...jupiterData, ...birdeyeData];
    
    // Update Airtable
    const table = getTable('TOKENS');
    await table.update(processedData);
    
    return NextResponse.json({ 
      success: true,
      tokensUpdated: processedData.length 
    });
  } catch (error) {
    console.error('Failed to fetch token data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token data' },
      { status: 500 }
    );
  }
}
