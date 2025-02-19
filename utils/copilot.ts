// Add PageContent interface
export interface CopilotContext {
  url: string;
  pageContent: string;
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

    const requestBody = {
      message,
      context: {
        url: currentUrl,
        pageContent: pageContent,
        ...context // Any additional context
      }
    };

    console.log('Preparing copilot request:', {
      messageLength: message.length,
      hasContext: !!context,
      contentLength: context.pageContent.length,
      walletPrefix: context.wallet ? context.wallet.slice(0, 8) + '...' : 'none'
    });

    const response = await fetch('/api/copilot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
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
