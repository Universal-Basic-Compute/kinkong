import { NextRequest, NextResponse } from 'next/server';
import { COPILOT_PROMPT } from '@/prompts/copilot';
import { spawn } from 'child_process';
import { promisify } from 'util';
const exec = promisify(require('child_process').exec);

async function getLatestMarketSentiment() {
  try {
    const table = getTable('MARKET_SENTIMENT');
    const records = await table
      .select({
        maxRecords: 1,
        sort: [{ field: 'weekEndDate', direction: 'desc' }]
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const sentiment = records[0].fields;
    return {
      classification: sentiment.classification,
      confidence: sentiment.confidence,
      tokensAbove7dAvg: sentiment.tokensAbove7dAvg,
      totalTokens: sentiment.totalTokens,
      weeklyVolume: sentiment.weeklyVolume,
      prevWeekVolume: sentiment.prevWeekVolume,
      solPerformance: sentiment.solPerformance,
      aiTokensPerformance: sentiment.aiTokensPerformance,
      notes: sentiment.notes
    };
  } catch (error) {
    console.error('Error fetching market sentiment:', error);
    return null;
  }
}

async function analyzeXSentiment(content: string) {
  try {
    // Call the Python script with the correct prompt
    const { stdout, stderr } = await exec(
      `python scripts/analyze_x_sentiment.py`,
      {
        env: {
          ...process.env,
          CONTENT: content
        },
        encoding: 'utf-8'
      }
    );

    if (stderr) {
      console.error('X sentiment analysis error:', stderr);
      return null;
    }

    return JSON.parse(stdout);
  } catch (error) {
    console.error('Failed to analyze X sentiment:', error);
    return null;
  }
}
import { rateLimit } from '@/utils/rate-limit';
import { getTable } from '@/backend/src/airtable/tables';
import { Signal } from '@/backend/src/airtable/tables';

interface FormattedSignal {
  id: string;
  createdAt: string;
  token: string;
  type: 'BUY' | 'SELL';
  timeframe: 'SCALP' | 'INTRADAY' | 'SWING' | 'POSITION';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  url?: string;
  expectedReturn?: number;
  actualReturn?: number;
  accuracy?: number;
}

async function getRecentSignals(): Promise<FormattedSignal[]> {
  try {
    const signalsTable = getTable('SIGNALS');
    const records = await signalsTable
      .select({
        maxRecords: 25,
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .all();

    return records.map(record => ({
      id: record.id,
      createdAt: record.get('createdAt') as string,
      token: record.get('token') as string,
      type: record.get('type') as 'BUY' | 'SELL',
      timeframe: record.get('timeframe') as 'SCALP' | 'INTRADAY' | 'SWING' | 'POSITION',
      entryPrice: record.get('entryPrice') as number | undefined,
      targetPrice: record.get('targetPrice') as number | undefined,
      stopLoss: record.get('stopLoss') as number | undefined,
      confidence: record.get('confidence') as 'LOW' | 'MEDIUM' | 'HIGH',
      reason: record.get('reason') as string,
      url: record.get('url') as string | undefined,
      expectedReturn: record.get('expectedReturn') as number | undefined,
      actualReturn: record.get('actualReturn') as number | undefined,
      accuracy: record.get('accuracy') as number | undefined
    }));
  } catch (error) {
    console.error('Error fetching recent signals:', error);
    return [];
  }
}
import { config } from 'dotenv';
import { resolve } from 'path';

// Force reload environment variables at the start of each request
config({ path: resolve(process.cwd(), '.env'), override: true });

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
});

interface CopilotRequest {
  message: string;
  body: string;
  wallet?: string; // Optional wallet address for history tracking
  url?: string;    // URL field for content source
}

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify API key is present
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not found in environment');
      throw new Error('API key configuration missing');
    }

    // Log key presence (safely)
    console.log('API Key check:', {
      present: !!apiKey,
      prefix: apiKey.substring(0, 7),
      length: apiKey.length
    });

    const requestBody = await request.json();
    
    // Extract message and wallet from body
    const message = requestBody.message;
    const wallet = requestBody.wallet;
    
    // Stringify the whole body
    const bodyContent = JSON.stringify(requestBody);

    // Build initial system prompt
    let systemPrompt = COPILOT_PROMPT;

    // Add detailed logging around the X content check
    console.log('\nDebug X content detection:', {
      requestBody: {
        message: requestBody.message,
        url: requestBody.url,
        bodyLength: bodyContent.length,
        bodyPreview: bodyContent.substring(0, 100) + '...'
      }
    });

    // Log each condition separately
    const conditions = {
      hasTwitterInBody: bodyContent.includes('twitter.com'),
      hasLowerXInBody: bodyContent.includes('x.com'),
      hasUpperXInBody: bodyContent.includes('X.com'),
      hasXUrl: requestBody.url === 'x.com'
    };

    console.log('X content detection conditions:', conditions);

    const isXContent = conditions.hasTwitterInBody || 
                      conditions.hasLowerXInBody ||
                      conditions.hasUpperXInBody ||
                      conditions.hasXUrl;

    console.log('Final isXContent result:', isXContent);

    // If X content, analyze sentiment
    if (isXContent) {
      console.log('📊 Starting X sentiment analysis...');
      
      const sentiment = await analyzeXSentiment(bodyContent);
      
      if (sentiment) {
        console.log('✅ X Sentiment Analysis completed:', sentiment);
        systemPrompt = `${systemPrompt}

=== X.COM SENTIMENT ANALYSIS ===
${JSON.stringify(sentiment, null, 2)}
===============================

`;
      } else {
        console.log('❌ X sentiment analysis failed or returned no results');
      }
    }

    // Get message history if wallet is provided
    let messageHistory: HistoryMessage[] = [];
    if (wallet) {
      const messagesTable = getTable('MESSAGES');
      
      // Debug log before query
      console.log('🔍 Fetching messages...');
      
      try {
        const records = await messagesTable.select({
          sort: [{ field: 'createdAt', direction: 'desc' }],
          maxRecords: 30
        }).all();

        // Debug log after query
        console.log('📝 Found records:', {
          count: records.length,
          firstRecord: records[0] ? {
            id: records[0].id,
            fields: records[0].fields
          } : null
        });

        messageHistory = records.map(record => {
          // Debug each record mapping
          const role = record.fields.role;
          const content = record.fields.content;
          
          console.log('Message record:', {
            role,
            contentPreview: content?.substring(0, 50)
          });

          return {
            role: role as 'user' | 'assistant',
            content: content
          };
        }).reverse();

        // Debug final history
        console.log('📚 Final message history:', {
          length: messageHistory.length,
          firstMessage: messageHistory[0]
        });

      } catch (error) {
        console.error('❌ Error fetching message history:', error);
      }
    }

    // Simple logging
    console.log('📝 Copilot Request:', {
      message: message,
      bodyLength: bodyContent.length,
      historyLength: messageHistory.length
    });

    // Get recent signals
    const recentSignals = await getRecentSignals();
    console.log('📊 Recent signals fetched:', recentSignals.length);

    // Format signals for context
    const signalsContext = recentSignals.map(signal => {
      const prices = [
        signal.entryPrice ? `Entry: $${signal.entryPrice.toFixed(4)}` : null,
        signal.targetPrice ? `Target: $${signal.targetPrice.toFixed(4)}` : null,
        signal.stopLoss ? `Stop: $${signal.stopLoss.toFixed(4)}` : null
      ].filter(Boolean).join(', ');

      const returns = [
        signal.expectedReturn !== undefined ? `Expected: ${signal.expectedReturn.toFixed(2)}%` : null,
        signal.actualReturn !== undefined ? `Actual: ${signal.actualReturn.toFixed(2)}%` : null,
        signal.accuracy !== undefined ? `Accuracy: ${signal.accuracy.toFixed(2)}%` : null
      ].filter(Boolean).join(', ');

      return `${signal.createdAt}: ${signal.token} ${signal.type} (${signal.timeframe}, ${signal.confidence})
    ${prices}
    ${returns}
    Reason: ${signal.reason}
    ${signal.url ? `URL: ${signal.url}` : ''}
  `.trim();
    }).join('\n\n');

    // Build messages array for Claude
    const messages = [
      ...messageHistory,
      {
        role: 'user',
        content: message
      }
    ];

    // If X content, analyze sentiment
    if (isXContent) {
      console.log('📊 Starting X sentiment analysis...');
      console.log('Using X sentiment prompt:', X_SENTIMENT_PROMPT.substring(0, 100) + '...');
      
      const sentiment = await analyzeXSentiment(bodyContent);
      
      if (sentiment) {
        console.log('✅ X Sentiment Analysis completed:', sentiment);
        systemPrompt = `${systemPrompt}

=== X.COM SENTIMENT ANALYSIS ===
${JSON.stringify(sentiment, null, 2)}
===============================

`;
      } else {
        console.log('❌ X sentiment analysis failed or returned no results');
      }
    }

    // Get market sentiment
    const marketSentiment = await getLatestMarketSentiment();

    // Add signals, sentiment and content to system prompt
    systemPrompt = `${systemPrompt}

Recent Trading Signals (Last 25):
--------------------------------
${signalsContext}

${marketSentiment ? `=== CURRENT MARKET SENTIMENT ===
Classification: ${marketSentiment.classification}
Confidence: ${marketSentiment.confidence}%
Market Health:
- ${marketSentiment.tokensAbove7dAvg}/${marketSentiment.totalTokens} tokens above 7d avg
- Volume: ${(marketSentiment.weeklyVolume / marketSentiment.prevWeekVolume - 1) * 100}% WoW
Performance:
- SOL: ${marketSentiment.solPerformance}%
- AI Tokens: ${marketSentiment.aiTokensPerformance}%
Analysis: ${marketSentiment.notes}
==============================

` : ''}Current Page Content:
${bodyContent}`;

    // Log formatted prompt
    console.log('📋 System Prompt:', {
      length: systemPrompt.length,
      preview: systemPrompt.slice(0, 200) + '...',
      signalsCount: recentSignals.length
    });

    // Make Anthropic API call
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
        messages: messages,
        system: systemPrompt
      })
    });

    // Log API response status
    console.log('✅ Anthropic API Response:', {
      status: response.status,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Failed to get copilot response: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.content[0].text;

    // Create stream response
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(assistantMessage));
        controller.close();
      }
    });

    // Save messages to history if wallet provided
    if (wallet) {
      try {
        console.log('💾 Saving messages to history for wallet:', wallet);
        const messagesTable = getTable('MESSAGES');
        
        const messagesToCreate = [
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
        ];

        console.log('Creating messages:', messagesToCreate);
        const result = await messagesTable.create(messagesToCreate);
        console.log('Messages saved:', result);

      } catch (error) {
        console.error('Failed to save messages:', error);
      }
    }

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });

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
        headers: {
          'Content-Type': 'application/json'
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
