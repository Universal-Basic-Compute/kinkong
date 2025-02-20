import { NextRequest, NextResponse } from 'next/server';
import { COPILOT_PROMPT } from '@/prompts/copilot';
import { rateLimit } from '@/utils/rate-limit';
import { getTable } from '@/backend/src/airtable/tables';

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
});

interface CopilotRequest {
  message: string;
  body: string;
  wallet?: string; // Optional wallet address for history tracking
}

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    
    // Extract message and wallet from body
    const message = requestBody.message;
    const wallet = requestBody.wallet;
    
    // Stringify the whole body
    const bodyContent = JSON.stringify(requestBody);

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

    // Build messages array for Claude
    const messages = [
      ...messageHistory,
      {
        role: 'user',
        content: message
      }
    ];

    // Simple system prompt
    const systemPrompt = `${COPILOT_PROMPT}

Current Page Content:
${bodyContent}`;

    // Log formatted prompt
    console.log('📋 System Prompt:', {
      length: systemPrompt.length,
      preview: systemPrompt.slice(0, 200) + '...'
    });

    // Make Anthropic API call
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
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
      throw new Error(`Failed to get copilot response: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.content[0].text;

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

    // Create stream response
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(assistantMessage));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('❌ Copilot error:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error'
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
