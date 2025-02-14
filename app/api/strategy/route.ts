import { readFileSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Lire le fichier markdown de stratégie
    const filePath = join(process.cwd(), 'knowledge', 'strategy.md');
    const content = readFileSync(filePath, 'utf-8');
    
    return NextResponse.json({ content });
  } catch (error) {
    console.error('Failed to read strategy file:', error);
    return NextResponse.json(
      { error: 'Failed to load strategy documentation' },
      { status: 500 }
    );
  }
}
