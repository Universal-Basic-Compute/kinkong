import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const chartsDir = path.join(process.cwd(), 'public', 'charts', 'trades');
    
    // Check if directory exists
    if (!fs.existsSync(chartsDir)) {
      return NextResponse.json({ charts: [] });
    }
    
    // Get all files in the directory
    const files = fs.readdirSync(chartsDir)
      .filter(file => {
        // Filter for image files
        const ext = path.extname(file).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.gif'].includes(ext);
      })
      .sort((a, b) => {
        // Sort by creation time (newest first)
        const statA = fs.statSync(path.join(chartsDir, a));
        const statB = fs.statSync(path.join(chartsDir, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      });
    
    return NextResponse.json({ charts: files });
  } catch (error) {
    console.error('Error reading trade charts directory:', error);
    return NextResponse.json({ error: 'Failed to fetch trade charts' }, { status: 500 });
  }
}
