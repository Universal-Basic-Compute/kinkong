import { NextRequest, NextResponse } from 'next/server';
import { createThought } from '@/backend/src/airtable/thoughts';
import { getTable } from '@/backend/src/airtable/tables';
import { COPILOT_PROMPT } from '@/prompts/copilot';
import { Record, FieldSet } from 'airtable';
import { rateLimit } from '@/utils/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 users per interval
});

interface MessageRecord extends FieldSet {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  wallet?: string;
  context?: string;
}

interface CopilotRequest {
  message: string;
  body: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CopilotRequest;
    const { message } = body;

    // Simple logging
    console.log('📝 Copilot Request:', {
      message: message?.slice(0, 100) + '...',
      bodyLength: body.body?.length || 0
    });

    // Simple system prompt
    const systemPrompt = `${COPILOT_PROMPT}

Current Page Content:
${body.body || 'No content available'}`;

        // Log formatted prompt
        console.log('📋 System Prompt:', {
          length: systemPrompt.length,
          preview: systemPrompt.slice(0, 200) + '...',
          hasPageContent: systemPrompt.includes('Content:')
        });

        // Make Anthropic API call
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
      code: (error as CopilotError).code,
      stack: error instanceof Error ? error.stack : undefined
    });

    const status = (error as CopilotError).status || 500;
    const code = (error as CopilotError).code || 'INTERNAL_ERROR';
    
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to process request',
        code,
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status,
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
