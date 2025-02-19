import { NextRequest, NextResponse } from 'next/server';
import { COPILOT_PROMPT } from '@/prompts/copilot';
import { rateLimit } from '@/utils/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
});

interface CopilotRequest {
  message: string;
  body: string;
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    
    // Extract message from body
    const message = requestBody.message;
    
    // Stringify the whole body
    const bodyContent = JSON.stringify(requestBody);

    // Simple logging
    console.log('📝 Copilot Request:', {
      message: message,
      bodyLength: bodyContent.length
    });

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
        messages: [
          {
            role: 'user',
            content: message
          }
        ],
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
