import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/utils/rate-limit';
import { getTable } from '@/backend/src/airtable/tables';
import { COPILOT_PROMPT } from '@/prompts/copilot';

// Helper function to get hours until next block with proper formatting
function getHoursUntilNext(): string {
  const now = new Date();
  const currentBlock = Math.floor(now.getUTCHours() / 8);
  const nextBlockStart = new Date(now);
  nextBlockStart.setUTCHours((currentBlock + 1) * 8, 0, 0, 0);
  
  const hoursRemaining = Math.ceil((nextBlockStart.getTime() - now.getTime()) / (1000 * 60 * 60));
  
  // Handle special cases
  if (hoursRemaining <= 0) return "1 hour"; // Prevent 0 hours
  if (hoursRemaining === 1) return "1 hour";
  return `${hoursRemaining} hours`;
}

const RATE_LIMIT_MESSAGES = [
  `Time for a quick break! 🎯 Hit my message limit. Want more trading insights? [Premium awaits](https://swarmtrade.ai/copilot)! 🚀\n\nKinKong will be back in ${getHoursUntilNext()}! 🕒`,
  
  `Whew, what a chat! 💬 Need to recharge for a bit. Get more trading insights with [premium](https://swarmtrade.ai/copilot) ✨\n\nKinKong will be back in ${getHoursUntilNext()}! 🕒`,
  
  `Hold that thought! 🤔 Message limit reached. Want more trading chats? Join [premium](https://swarmtrade.ai/copilot) 💪\n\nKinKong will be back in ${getHoursUntilNext()}! 🕒`,
  
  `Taking a breather! 😅 Max messages hit. Want more trading time? [Upgrade here](https://swarmtrade.ai/copilot) 🎓\n\nKinKong will be back in ${getHoursUntilNext()}! 🕒`,
  
  `Energy check! ⚡ Need to rest my circuits. Want more trading convos? [Premium's calling](https://swarmtrade.ai/copilot) 🌟\n\nKinKong will be back in ${getHoursUntilNext()}! 🕒`
];

// Initialize global rate limiter
const rateLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
});

// Helper function to check wallet message limit
async function checkMessageLimit(code: string): Promise<boolean> {
  try {
    // First check if code has active subscription
    const subscriptionsTable = getTable('SUBSCRIPTIONS');
    const subscriptions = await subscriptionsTable.select({
      filterByFormula: `AND(
        {code}='${code}',
        {status}='ACTIVE',
        {endDate}>=TODAY()
      )`
    }).firstPage();

    // If has active subscription, allow 100 messages per block
    const messageLimit = subscriptions.length > 0 ? 100 : 20;

    // Calculate current 8-hour block
    const now = new Date();
    const blockNumber = Math.floor(now.getUTCHours() / 8);
    const blockStart = new Date(now);
    blockStart.setUTCHours(blockNumber * 8, 0, 0, 0); // Start of current 8-hour block
    const blockEnd = new Date(blockStart);
    blockEnd.setUTCHours(blockStart.getUTCHours() + 8); // End of current 8-hour block

    const messagesTable = getTable('MESSAGES');
    
    // Query messages from this code in current 8-hour block
    const records = await messagesTable.select({
      filterByFormula: `AND(
        {code}='${code}',
        IS_AFTER({createdAt}, '${blockStart.toISOString()}'),
        IS_BEFORE({createdAt}, '${blockEnd.toISOString()}')
      )`
    }).all();

    console.log(`Found ${records.length} messages for code ${code} in current block`);
    console.log(`Current block: ${blockNumber} (${blockStart.toISOString()} - ${blockEnd.toISOString()})`);
    console.log(`Code has active subscription: ${subscriptions.length > 0}`);
    console.log(`Message limit: ${messageLimit}`);
    console.log(`Messages used in current block: ${records.length}`);
    console.log(`Time until next block: ${new Date(blockEnd).getTime() - now.getTime()}ms`);

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
    const { message, code } = requestBody;

    // Validate code
    if (!code) {
      return new NextResponse(
        JSON.stringify({ error: 'Code required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Check code-specific rate limit
    const isUnderLimit = await checkMessageLimit(code);
    if (!isUnderLimit) {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const randomMessage = RATE_LIMIT_MESSAGES[Math.floor(Math.random() * RATE_LIMIT_MESSAGES.length)];
          controller.enqueue(encoder.encode(randomMessage));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });
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

    // Get context data
    const contextData = await getContextData();
    
    // Prepare full context
    const fullContext = {
      request: requestBody,
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

      if (code) {
        const messagesTable = getTable('MESSAGES');
        await messagesTable.create([
          {
            fields: {
              code,
              role: 'user',
              content: message,
              createdAt: new Date().toISOString()
            }
          },
          {
            fields: {
              code,
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
