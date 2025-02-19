import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

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

    // Make direct API call to Claude
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `${SYSTEM_PROMPT}\n\n${contextString}\nUser Question: ${message}`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();

    // Log interaction for monitoring
    console.log('KinKong-copilot interaction:', {
      timestamp: new Date().toISOString(),
      message,
      contextProvided: !!context,
      responseLength: data.content?.[0]?.text?.length
    });

    // Create thought record in Airtable
    await createThought({
      type: 'COPILOT_INTERACTION',
      content: message,
      response: data.content[0].text,
      context: context || {}
    });

    // Return response
    return NextResponse.json({
      response: data.content[0].text,
      metadata: {
        model: data.model,
        usage: data.usage
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
    // Create Airtable instance directly
    if (!process.env.KINOS_AIRTABLE_API_KEY || !process.env.KINOS_AIRTABLE_BASE_ID) {
      console.warn('Kinos Airtable configuration missing');
      return;
    }

    const kinosBase = new Airtable({
      apiKey: process.env.KINOS_AIRTABLE_API_KEY
    }).base(process.env.KINOS_AIRTABLE_BASE_ID);

    const thoughtsTable = kinosBase.table('THOUGHTS');

    const record = await thoughtsTable.create([{
      fields: {
        type: params.type,
        content: params.content,
        response: params.response,
        context: JSON.stringify(params.context),
        timestamp: new Date().toISOString()
      }
    }]);

    return record;

  } catch (error) {
    console.error('Failed to create thought:', error);
    // Don't throw - we don't want to fail the main request if thought creation fails
  }
}
