import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const signalId = searchParams.get('id');
    
    if (!signalId) {
      return NextResponse.json(
        { error: 'Signal ID is required' },
        { status: 400 }
      );
    }
    
    // Execute the Python script to generate the chart
    console.log(`Generating trade chart for signal ${signalId}...`);
    
    const { stdout, stderr } = await execPromise(`python scripts/generate_trade_chart.py ${signalId}`);
    
    if (stderr && !stderr.includes('UserWarning')) {
      console.error('Error generating chart:', stderr);
      return NextResponse.json(
        { error: 'Failed to generate chart', details: stderr },
        { status: 500 }
      );
    }
    
    // Check if the chart was generated
    const chartDir = path.join(process.cwd(), 'public', 'charts', 'trades');
    const files = fs.readdirSync(chartDir);
    const chartFile = files.find(file => file.includes(signalId));
    
    if (!chartFile) {
      return NextResponse.json(
        { error: 'Chart generation failed or no data available' },
        { status: 404 }
      );
    }
    
    // Return the chart URL
    const chartUrl = `/charts/trades/${chartFile}`;
    
    return NextResponse.json({
      success: true,
      chartUrl,
      message: 'Chart generated successfully'
    });
    
  } catch (error) {
    console.error('Error in chart generation API:', error);
    return NextResponse.json(
      { error: 'Failed to generate chart', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
