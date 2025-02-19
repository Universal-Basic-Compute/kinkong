import { NextRequest, NextResponse } from 'next/server';
import { createThought } from '@/backend/src/airtable/thoughts';
import { getTable } from '@/backend/src/airtable/tables';
import { COPILOT_PROMPT } from '@/prompts/copilot';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const customEncode = (str: string) => encoder.encode(str + '\n');

  try {
    const body = await request.json();
    const { message, context } = body;

    if (!message) {
      throw new Error('Message is required');
    }

    // Get recent message history
    const messagesTable = getTable('MESSAGES');
    const recentMessages = await messagesTable
      .select({
        maxRecords: 20,
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .all();

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
        createdAt: new Date().toISOString().split('.')[0]+"Z",  // Format: "2024-03-14T15:30:00Z"
        role: 'user',
        content: message,
        wallet: context?.wallet || '',
        context: context ? JSON.stringify(context) : ''
      }
    }]);

    // Create streaming response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    const response = new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    // Get copilot response with conversation history
    const copilotResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',  // Provide empty string as fallback
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      } as HeadersInit,  // Explicitly type as HeadersInit
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: `${COPILOT_PROMPT}

Current Context:
URL: ${context?.url || 'Not provided'}
Page Content: ${context?.pageContent || 'Not provided'}`,
        messages: [
          // Include conversation history
          ...conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          // Add the current message
          {
            role: 'user',
            content: message
          }
        ]
      })
    });

    if (!copilotResponse.ok) {
      throw new Error('Failed to get copilot response');
    }

    const data = await copilotResponse.json();
    const assistantMessage = data.content[0].text;

    // Save assistant message
    await messagesTable.create([{
      fields: {
        createdAt: new Date().toISOString().split('.')[0]+"Z",  // Format: "2024-03-14T15:30:00Z"
        role: 'assistant',
        content: assistantMessage,
        wallet: context?.wallet || '',
        context: context ? JSON.stringify(context) : ''
      }
    }]);

    // Stream the response in chunks
    const chunks = assistantMessage.match(/.{1,1000}/g) || [];
    for (const chunk of chunks) {
      await writer.write(customEncode(chunk));
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Create thought record
    try {
      await createThought({
        type: 'COPILOT_INTERACTION',
        content: message,
        context: {
          response: assistantMessage,
          ...context || {}
        }
      });
    } catch (error) {
      console.error('Failed to create thought:', error);
    }

    await writer.close();
    return response;

  } catch (error) {
    console.error('Copilot error:', error);
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
