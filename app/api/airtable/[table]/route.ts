import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Verify environment variables
if (!process.env.KINKONG_AIRTABLE_API_KEY || !process.env.KINKONG_AIRTABLE_BASE_ID) {
  throw new Error('Missing required Airtable configuration');
}

// Configure Airtable with verified environment variables
const base = new Airtable({
  apiKey: process.env.KINKONG_AIRTABLE_API_KEY
}).base(process.env.KINKONG_AIRTABLE_BASE_ID);

// Define allowed tables and their fields for public access
const ALLOWED_TABLES = {
  'SIGNALS': [
    'id', 'createdAt', 'token', 'type', 'timeframe',
    'entryPrice', 'targetPrice', 'stopLoss', 'confidence',
    'wallet', 'reason', 'expiryDate', 'actualReturn'
  ],
  'TOKENS': [
    'token', 'name', 'mint', 'isActive', 'volume7d',
    'liquidity', 'priceChange24h'
  ],
  'TRADES': [
    'timestamp', 'token', 'type', 'amount', 'price',
    'value', 'signature', 'status'
  ]
} as const;

type AllowedTable = keyof typeof ALLOWED_TABLES;

export async function GET(
  request: NextRequest,
  { params }: { params: { table: string } }
) {
  try {
    const { table } = params;
    const { searchParams } = new URL(request.url);
    
    // Validate table name
    if (!ALLOWED_TABLES[table as AllowedTable]) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid table name' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        }
      );
    }

    // Get query parameters
    const formula = searchParams.get('formula') || '';
    const sort = searchParams.get('sort');
    const maxRecords = searchParams.get('maxRecords');

    // Build query options
    const queryOptions: any = {};
    if (formula) queryOptions.filterByFormula = formula;
    if (sort) {
      try {
        queryOptions.sort = JSON.parse(sort);
      } catch (e) {
        console.warn('Invalid sort parameter:', sort);
      }
    }
    if (maxRecords) queryOptions.maxRecords = parseInt(maxRecords);

    // Fetch data from Airtable
    const records = await base.table(table).select(queryOptions).all();

    // Filter fields for public access
    const allowedFields = ALLOWED_TABLES[table as AllowedTable];
    const filteredRecords = records.map(record => {
      const fields = {} as any;
      allowedFields.forEach(field => {
        if (record.fields[field] !== undefined) {
          fields[field] = record.fields[field];
        }
      });
      return {
        id: record.id,
        fields
      };
    });

    // Return with proper headers
    return new NextResponse(
      JSON.stringify({ records: filteredRecords }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, s-maxage=300'
        }
      }
    );

  } catch (error) {
    console.error('Airtable proxy error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      }
    );
  }
}

// Add OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
