import { NextRequest } from 'next/server';
import { createThought } from '@/backend/src/airtable/thoughts';
import { getTable } from '@/backend/src/airtable/tables';

export async function POST(request: NextRequest) {
  // Set up streaming
  const encoder = new TextEncoder();
  const customEncode = (str: string) => encoder.encode(str + '\n');

  try {
    // Parse request
    const body = await request.json();
    const { message, context } = body;

    if (!message) {
      throw new Error('Message is required');
    }

    // Create streaming response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Start the response
    const response = new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    // Save user message
    const messagesTable = getTable('MESSAGES');
    await messagesTable.create([{
      fields: {
        timestamp: new Date().toISOString(),
        role: 'user',
        content: message,
        wallet: context?.wallet || '',
        context: context ? JSON.stringify(context) : ''
      }
    }]);

    // Get copilot response by calling kinkong-copilot endpoint
    const copilotResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kinkong-copilot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        context
      })
    });

    if (!copilotResponse.ok) {
      throw new Error('Failed to get copilot response');
    }

    const data = await copilotResponse.json();

    // Save assistant message
    await messagesTable.create([{
      fields: {
        timestamp: new Date().toISOString(),
        role: 'assistant',
        content: data.response,
        wallet: context?.wallet || '',
        context: context ? JSON.stringify(context) : ''
      }
    }]);

    // Stream the response in chunks
    const chunks = data.response.match(/.{1,1000}/g) || [];
    for (const chunk of chunks) {
      await writer.write(customEncode(chunk));
      // Add a small delay between chunks to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Create thought record after sending response
    try {
      await createThought({
        type: 'COPILOT_INTERACTION',
        content: message,
        response: data.response,
        context: context || {}
      });
    } catch (error) {
      console.error('Failed to create thought:', error);
      // Don't throw - we don't want to fail the main request
    }

    // Close the stream
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
