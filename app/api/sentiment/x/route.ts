import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promisify } from 'util';
const exec = promisify(require('child_process').exec);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Call Python script
    const { stdout, stderr } = await exec(
      `python scripts/analyze_x_sentiment.py`,
      {
        input: content,
        encoding: 'utf-8'
      }
    );

    if (stderr) {
      console.error('X sentiment analysis error:', stderr);
      throw new Error(stderr);
    }

    const analysis = JSON.parse(stdout);
    return NextResponse.json(analysis);

  } catch (error) {
    console.error('Failed to analyze X sentiment:', error);
    return NextResponse.json(
      { error: 'Failed to analyze sentiment' },
      { status: 500 }
    );
  }
}
