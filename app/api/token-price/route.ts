import { getTable } from '@/backend/src/airtable/tables';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token symbol required' }, { status: 400 });
  }

  try {
    console.log(`Fetching price for token: ${token}`);
    
    // Get the token snapshots table
    const snapshotsTable = getTable('TOKEN_SNAPSHOTS');
    
    // Get the latest snapshot for the specified token
    const snapshots = await snapshotsTable.select({
      filterByFormula: `{token}='${token}'`,
      sort: [{ field: 'createdAt', direction: 'desc' }],
      maxRecords: 1
    }).firstPage();
    
    if (snapshots.length === 0) {
      console.log(`No snapshots found for token: ${token}`);
      return NextResponse.json({ error: 'No price data found' }, { status: 404 });
    }
    
    const snapshot = snapshots[0];
    const price = snapshot.get('price');
    
    if (!price) {
      console.log(`No price field in snapshot for token: ${token}`);
      return NextResponse.json({ error: 'No price data found' }, { status: 404 });
    }
    
    console.log(`Found price for ${token}: $${price}`);
    
    return NextResponse.json({
      token,
      price,
      timestamp: snapshot.get('createdAt')
    });
    
  } catch (error) {
    console.error(`Failed to fetch price for token ${token}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch token price' },
      { status: 500 }
    );
  }
}
