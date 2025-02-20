import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/utils/rate-limit';
import { getTable } from '@/backend/src/airtable/tables';
import { getTable } from '@/backend/src/airtable/tables';
import { COPILOT_PROMPT } from '@/prompts/copilot';

// Initialize global rate limiter
const rateLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
});

// Helper function to check wallet message limit
async function checkWalletMessageLimit(wallet: string): Promise<boolean> {
  try {
    // First check if wallet has active subscription
    const subscriptionsTable = getTable('SUBSCRIPTIONS');
    const subscriptions = await subscriptionsTable.select({
      filterByFormula: `AND(
        {wallet}='${wallet}',
        {status}='ACTIVE',
        {endDate}>=TODAY()
      )`
    }).firstPage();

    // If has active subscription, allow 100 messages per 4 hours
    const messageLimit = subscriptions.length > 0 ? 100 : 10;

    const messagesTable = getTable('MESSAGES');
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    // Query messages from this wallet in last 4 hours
    const records = await messagesTable.select({
      filterByFormula: `AND(
        {wallet}='${wallet}',
        IS_AFTER({createdAt}, '${fourHoursAgo}')
      )`
    }).all();

    console.log(`Found ${records.length} messages for wallet ${wallet} in last 4 hours`);
    console.log(`Wallet has active subscription: ${subscriptions.length > 0}`);
    console.log(`Message limit: ${messageLimit}`);

    return records.length < messageLimit; // Return true if under limit
  } catch (error) {
    console.error('Error checking wallet message limit:', error);
    throw error;
  }
}

async function getContextData() {
  try {
    // Get last 25 signals
    const signalsTable = getTable('SIGNALS');
    const signals = await signalsTable
      .select({
        maxRecords: 25,
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .all();

    // Get latest market sentiment
    const sentimentTable = getTable('MARKET_SENTIMENT');
    const sentiment = await sentimentTable
      .select({
        maxRecords: 1,
        sort: [{ field: 'weekEndDate', direction: 'desc' }]
      })
      .firstPage();

    return {
      signals: signals.map(record => ({
        token: record.get('token'),
        type: record.get('type'),
        timeframe: record.get('timeframe'),
        confidence: record.get('confidence'),
        reason: record.get('reason'),
        createdAt: record.get('createdAt'),
        actualReturn: record.get('actualReturn'),
        success: record.get('success')
      })),
      marketSentiment: sentiment.length > 0 ? {
        classification: sentiment[0].get('classification'),
        confidence: sentiment[0].get('confidence'),
        tokensAbove7dAvg: sentiment[0].get('tokensAbove7dAvg'),
        totalTokens: sentiment[0].get('totalTokens'),
        solPerformance: sentiment[0].get('solPerformance'),
        aiTokensPerformance: sentiment[0].get('aiTokensPerformance'),
        notes: sentiment[0].get('notes'),
        weekEndDate: sentiment[0].get('weekEndDate')
      } : null
    };
  } catch (error) {
    console.error('Error fetching context data:', error);
    return { signals: [], marketSentiment: null };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Global rate limit check
    await rateLimiter.check(5, 'copilot_api');

    const requestBody = await request.json();
    const { message, wallet } = requestBody;

    // Validate wallet address
    if (!wallet) {
      return new NextResponse(
        JSON.stringify({ error: 'Wallet address required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Check wallet-specific rate limit
    const isUnderLimit = await checkWalletMessageLimit(wallet);
    if (!isUnderLimit) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          details: 'Maximum messages reached for your tier. Subscribe for increased limits.',
          subscription: {
            free: '10 messages per 4 hours',
            premium: '100 messages per 4 hours'
          }
        }),
        { 
          status: 429,
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': '14400' // 4 hours in seconds
          }
        }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not found in environment');
      throw new Error('API key configuration missing');
    }

    console.log('API Key check:', {
      present: !!apiKey,
      prefix: apiKey.substring(0, 7),
      length: apiKey.length
    });

    const requestBody = await request.json();
    const { message, body, wallet } = requestBody;
    
    // Get context data
    const contextData = await getContextData();
    
    // Prepare full context
    const fullContext = {
      pageContent: body,
      requestData: requestBody,
      signals: contextData.signals,
      marketSentiment: contextData.marketSentiment
    };

    const bodyContent = JSON.stringify(fullContext);

    let systemPrompt = COPILOT_PROMPT;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: message
          }],
          system: `${systemPrompt}\n\nPage Content:\n${bodyContent}`
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = data.content[0].text;

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(assistantMessage));
          controller.close();
        }
      });

      if (wallet) {
        const messagesTable = getTable('MESSAGES');
        await messagesTable.create([
          {
            fields: {
              wallet,
              role: 'user',
              content: message,
              createdAt: new Date().toISOString()
            }
          },
          {
            fields: {
              wallet,
              role: 'assistant',
              content: assistantMessage,
              createdAt: new Date().toISOString()
            }
          }
        ]);
      }

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return new NextResponse(
          JSON.stringify({
            error: 'Request timeout after 30 seconds',
            details: 'The request took too long to complete'
          }),
          {
            status: 408,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('❌ Copilot error:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return new NextResponse(
      JSON.stringify({
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
