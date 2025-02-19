// Add PageContent interface
interface PageContent {
  url: string;
  pageContent: string;
}

export interface CopilotContext {
  url?: string;
  pageContent?: string | PageContent;  // Can be either string or PageContent object
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
    // Get current page content
    const pageContent = document.body.innerText;
    const currentUrl = window.location.href;

    // Add debug log
    console.log('Preparing copilot request:', {
      message,
      url: currentUrl,
      contentLength: pageContent.length
    });

    const response = await fetch('/api/copilot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        context: {
          url: currentUrl,
          pageContent: pageContent,
          ...context // Spread any additional context
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
