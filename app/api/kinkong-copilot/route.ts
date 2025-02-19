import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SYSTEM_PROMPT = `You are KinKong-copilot, an AI assistant specialized in Solana DeFi trading and portfolio management.
You have deep knowledge of:
- Technical analysis and chart patterns
- Trading strategies and risk management
- Solana DeFi ecosystem and tokens
- Portfolio rebalancing and optimization

Use this knowledge to provide clear, actionable advice while maintaining risk awareness.
Always consider:
- Market conditions and sentiment
- Risk/reward ratios
- Position sizing
- Technical levels
- Market liquidity

Format responses in a clear, structured way using markdown.`;

export async function POST(request: NextRequest) {
  try {
    // Validate request
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Parse request body
    const body = await request.json();
    const { message, context } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Prepare context string
    let contextString = '';
    if (context) {
      contextString = `
Current Context:
- Market Sentiment: ${context.marketSentiment || 'Unknown'}
- Portfolio Value: ${context.portfolioValue || 'Unknown'}
- Top Holdings: ${context.topHoldings?.join(', ') || 'None'}
- Recent Trades: ${context.recentTrades || 'None'}
`;
    }

    // Get response from Claude using the correct model and API
    const response = await anthropic.beta.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4096,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${contextString}\nUser Question: ${message}`
      }]
    });

    // Log interaction for monitoring
    console.log('KinKong-copilot interaction:', {
      timestamp: new Date().toISOString(),
      message,
      contextProvided: !!context,
      responseLength: response.content.length
    });

    // Create thought record in Airtable
    await createThought({
      type: 'COPILOT_INTERACTION',
      content: message,
      response: response.content[0].text,
      context: context || {}
    });

    // Return response
    return NextResponse.json({
      response: response.content[0].text,
      metadata: {
        model: response.model,
        role: response.role
      }
    });

  } catch (error) {
    console.error('KinKong-copilot error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function createThought(params: {
  type: string;
  content: string;
  response: string;
  context: any;
}) {
  try {
    const response = await fetch('/api/thoughts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error('Failed to create thought record');
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to create thought:', error);
    // Don't throw - we don't want to fail the main request if thought creation fails
  }
}
