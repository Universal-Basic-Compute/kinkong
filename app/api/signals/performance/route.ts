import { NextResponse } from 'next/server';
import { getTable } from '@/backend/src/airtable/tables';

export async function GET() {
  try {
    console.log('Fetching signal performance metrics...');
    
    const table = getTable('PERFORMANCES');
    
    // Get the most recent performance metrics record
    const records = await table
      .select({
        filterByFormula: "{type}='signals'",
        sort: [{ field: 'createdAt', direction: 'desc' }],
        maxRecords: 1
      })
      .all();
    
    if (!records || records.length === 0) {
      return NextResponse.json(
        { error: 'No performance metrics found' },
        { status: 404 }
      );
    }
    
    const latestRecord = records[0];
    const metricsJson = latestRecord.get('metrics') as string;
    
    // Fix NaN values in the JSON string before parsing
    const fixedJson = metricsJson.replace(/"position_return": NaN/g, '"position_return": null');
    
    // Parse the fixed JSON string into an object with error handling
    let metrics;
    try {
      metrics = JSON.parse(fixedJson);
      
      // Replace any remaining NaN values with null
      const sanitizeNaN = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'number' && isNaN(obj)) return null;
        if (typeof obj !== 'object') return obj;
        
        if (Array.isArray(obj)) {
          return obj.map(sanitizeNaN);
        }
        
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = sanitizeNaN(value);
        }
        return result;
      };
      
      metrics = sanitizeNaN(metrics);
      
    } catch (parseError) {
      console.error('Error parsing metrics JSON:', parseError);
      console.error('Invalid JSON string:', metricsJson);
      
      // If parsing fails, try a more aggressive approach to fix the JSON
      try {
        // Replace all NaN, Infinity, -Infinity with null
        const aggressivelyFixedJson = metricsJson
          .replace(/: NaN/g, ': null')
          .replace(/: Infinity/g, ': null')
          .replace(/: -Infinity/g, ': null');
        
        metrics = JSON.parse(aggressivelyFixedJson);
        console.log('Successfully parsed JSON after aggressive fixing');
      } catch (secondError) {
        console.error('Failed to parse JSON even after aggressive fixing:', secondError);
        return NextResponse.json(
          { error: 'Invalid metrics data format' },
          { status: 500 }
        );
      }
    }
    
    // Add the record ID and creation date
    const response = {
      id: latestRecord.id,
      createdAt: latestRecord.get('createdAt'),
      metrics
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}
