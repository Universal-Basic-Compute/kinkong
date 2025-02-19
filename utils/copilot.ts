export interface CopilotContext {
  url?: string;
  pageContent?: string;
  marketSentiment?: string;
  portfolioValue?: number;
  topHoldings?: string[];
  recentTrades?: string;
  wallet?: string;
}

export async function askKinKongCopilot(
  message: string, 
  context?: CopilotContext
) {
  try {
    // Add debug log
    console.log('Sending copilot request:', {
      message,
      contextSummary: {
        hasContext: !!context,
        url: context?.url,
        pageContentLength: context?.pageContent ? 
          (typeof context.pageContent === 'string' ? 
            context.pageContent.length : 
            JSON.stringify(context.pageContent).length) 
          : 0
      }
    });

    const response = await fetch('/api/copilot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        context: {
          url: window.location.href,  // Always include current URL
          pageContent: context?.pageContent || document.body.innerText // Fallback to page content
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get copilot response');
    }

    // Handle streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let result = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        result += chunk;
      }
    }

    return result;

  } catch (error) {
    console.error('Error asking KinKong-copilot:', error);
    throw error;
  }
}
