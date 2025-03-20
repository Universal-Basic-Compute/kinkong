import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET(request: NextRequest) {
  try {
    if (!process.env.KINKONG_AIRTABLE_API_KEY || !process.env.KINKONG_AIRTABLE_BASE_ID) {
      return NextResponse.json(
        { error: 'Airtable configuration is missing' },
        { status: 500 }
      );
    }

    // Get the redistributions table
    const redistributionsTable = getTable('INVESTOR_REDISTRIBUTIONS');
    const investmentsTable = getTable('INVESTMENTS');
    
    // Get all records, sorted by createdAt in descending order
    const records = await redistributionsTable
      .select({
        sort: [{ field: 'createdAt', direction: 'desc' }],
        filterByFormula: 'NOT({amount} = 0)' // Filter out zero amounts
      })
      .all();

    console.log(`Found ${records.length} redistributions`);

    // Create a map to store investment data
    const investmentMap = new Map();
    
    // Collect all investment IDs
    const investmentIds = records
      .map(record => record.get('investmentId'))
      .filter(id => id) as string[];
    
    // If we have investment IDs, fetch the corresponding investments
    if (investmentIds.length > 0) {
      console.log(`Fetching data for ${investmentIds.length} investments`);
      
      // Create batches of 100 IDs to avoid formula length limits
      const batchSize = 100;
      for (let i = 0; i < investmentIds.length; i += batchSize) {
        const batchIds = investmentIds.slice(i, i + batchSize);
        const formula = `OR(${batchIds.map(id => `{investmentId}='${id}'`).join(',')})`;
        
        try {
          const investmentRecords = await investmentsTable
            .select({
              filterByFormula: formula
            })
            .all();
          
          console.log(`Fetched ${investmentRecords.length} investments for batch ${i/batchSize + 1}`);
          
          // Store investment data in the map
          investmentRecords.forEach(record => {
            const id = record.get('investmentId');
            if (id) {
              investmentMap.set(id, {
                wallet: record.get('wallet'),
                username: record.get('username') || 'Anonymous'
              });
            }
          });
        } catch (batchError) {
          console.error(`Error fetching batch ${i/batchSize + 1}:`, batchError);
        }
      }
    }

    // Map the records to the expected format
    const redistributions = records.map(record => {
      const investmentId = record.get('investmentId') as string;
      const investment = investmentId ? investmentMap.get(investmentId) : null;
      
      // Use the wallet from the original investment if available
      const recordWallet = record.get('wallet') as string;
      const investmentWallet = investment?.wallet as string;
      
      // Log any wallet mismatches for debugging
      if (recordWallet && investmentWallet && recordWallet !== investmentWallet) {
        console.log(`Wallet mismatch for redistribution ${record.id}:`, {
          redistributionWallet: recordWallet,
          investmentWallet: investmentWallet
        });
      }
      
      // Always prioritize the investment wallet over the redistribution wallet
      // This ensures we're using the original investor's wallet
      const wallet = investmentWallet || recordWallet;
      
      // If there's a mismatch and we have both wallets, log it for debugging
      if (investmentWallet && recordWallet && investmentWallet !== recordWallet) {
        console.log(`Wallet mismatch for redistribution ${record.id} - using investment wallet:`, {
          redistributionWallet: recordWallet,
          investmentWallet: investmentWallet,
          usingWallet: wallet
        });
      }
      
      return {
        investmentId: record.id, // Use the record ID as the investment ID
        wallet: wallet,
        token: record.get('token') as string, // Get the token field
        amount: record.get('amount') as number, // Get the amount field
        percentage: record.get('percentage') as number,
        date: record.get('createdAt') as string,
        claimed: record.get('claimed') as boolean || false,
        hasSubscription: record.get('hasSubscription') as boolean || false,
        effectiveRate: record.get('effectiveRate') as number || 75,
        redistributionId: record.get('redistributionId') as string,
        username: investment?.username || record.get('username') as string || 'Anonymous'
      };
    });

    console.log(`Returning ${redistributions.length} redistributions`);
    return NextResponse.json(redistributions);
  } catch (error) {
    console.error('Error fetching redistributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch redistributions' },
      { status: 500 }
    );
  }
}
