import { NextRequest, NextResponse } from 'next/server';
import { createThought } from '@/backend/src/airtable/thoughts';
import { getTable } from '@/backend/src/airtable/tables';
import { COPILOT_PROMPT } from '@/prompts/copilot';
import { Record, FieldSet } from 'airtable';

interface MessageRecord extends FieldSet {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  wallet?: string;
  context?: string;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const customEncode = (str: string) => encoder.encode(str + '\n');

  try {
    const body = await request.json();
    const { message, context } = body;

    // Log incoming request
    console.log('📝 Copilot Request:', {
      message: message?.slice(0, 100) + '...',  // Truncate long messages
      hasContext: !!context,
      url: context?.url,
      contextType: context ? typeof context.pageContent : 'none'
    });

    if (!message) {
      throw new Error('Message is required');
    }

    // Log context details
    if (context) {
      console.log('🔍 Context Details:', {
        url: context.url,
        pageContentType: typeof context.pageContent,
        isNestedObject: typeof context.pageContent === 'object',
        nestedContent: typeof context.pageContent === 'object' 
          ? typeof context.pageContent.pageContent 
          : 'n/a'
      });
    }

    // Create streaming response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Set up response with proper headers
    const response = new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    // Start background processing
    (async () => {
      try {
        // Get recent message history with timeout
        const messagesTable = getTable('MESSAGES');
        const recentMessages = await Promise.race([
          messagesTable.select({
            maxRecords: 20,
            sort: [{ field: 'createdAt', direction: 'desc' }]
          }).all() as Promise<Array<Record<MessageRecord>>>,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Message history timeout')), 5000)
          )
        ]) as Array<Record<MessageRecord>>;

        // Format conversation history
        const conversationHistory = recentMessages
          .reverse()
          .map(record => ({
            role: record.get('role') as 'user' | 'assistant',
            content: record.get('content') as string
          }));

        // Save user message
        await messagesTable.create([{
          fields: {
            createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
            role: 'user',
            content: message,
            wallet: context?.wallet || '',
            context: context ? JSON.stringify(context) : ''
          }
        }]);

        // Get copilot response with timeout
        // Format system prompt
        const systemPrompt = `${COPILOT_PROMPT}

Current Website Context:
URL: ${context?.url || 'Not provided'}

Page Content:
${typeof context?.pageContent === 'object' 
  ? context.pageContent.pageContent || JSON.stringify(context.pageContent, null, 2)
  : context?.pageContent || 'Not provided'}`;

        // Log formatted system prompt (truncated)
        console.log('📋 System Prompt Preview:', {
          length: systemPrompt.length,
          preview: systemPrompt.slice(0, 200) + '...',
          hasPageContent: systemPrompt.includes('Page Content:')
        });

        // Log before making Anthropic API call
        console.log('🚀 Sending request to Anthropic:', {
          model: "claude-3-5-sonnet-20241022",
          messageCount: conversationHistory.length + 1,
          systemPromptLength: systemPrompt.length
        });

        // Log before making Anthropic API call
        console.log('🚀 Sending request to Anthropic:', {
          model: "claude-3-5-sonnet-20241022",
          messageCount: conversationHistory.length + 1,
          systemPromptLength: systemPrompt.length
        });

        const copilotResponse = await Promise.race([
          fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': process.env.ANTHROPIC_API_KEY || '',
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              model: "claude-3-5-sonnet-20241022",
              max_tokens: 1024,
              messages: [
                ...conversationHistory.map(msg => ({
                  role: msg.role,
                  content: msg.content
                })),
                {
                  role: 'user',
                  content: message
                }
              ],
              system: systemPrompt
            })
          }) as Promise<Response>,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Copilot response timeout')), 15000)
          )
        ]) as Response;

        // Log Anthropic API response status
        console.log('✅ Anthropic API Response:', {
          status: copilotResponse.status,
          ok: copilotResponse.ok
        });

        // Log Anthropic API response status
        console.log('✅ Anthropic API Response:', {
          status: copilotResponse.status,
          ok: copilotResponse.ok
        });

        if (!copilotResponse.ok) {
          throw new Error(`Failed to get copilot response: ${copilotResponse.status} ${copilotResponse.statusText}`);
        }

        const data = await copilotResponse.json();
        const assistantMessage = data.content[0].text;

        console.log('📤 Assistant Message:', {
          length: assistantMessage.length,
          preview: assistantMessage.slice(0, 100) + '...'
        });

        // Save assistant message
        await messagesTable.create([{
          fields: {
            createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
            role: 'assistant',
            content: assistantMessage,
            wallet: context?.wallet || '',
            context: context ? JSON.stringify(context) : ''
          }
        }]);

        // Stream the response in smaller chunks
        const chunks = assistantMessage.match(/.{1,500}/g) || [];
        for (const chunk of chunks) {
          await writer.write(customEncode(chunk));
          await new Promise(resolve => setTimeout(resolve, 25)); // Small delay between chunks
        }

        await writer.close();

      } catch (error) {
        console.error('Streaming error:', error);
        await writer.write(customEncode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        await writer.close();
      }
    })();

    return response;

  } catch (error) {
    console.error('❌ Copilot error:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return new Response(
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
