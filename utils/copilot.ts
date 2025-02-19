export interface CopilotContext {
  url: string;
  pageContent: string; // Simplify to just string
  wallet?: string;
}

export async function askKinKongCopilot(
  message: string, 
  context?: CopilotContext
) {
  try {
    // Get current page content if not provided
    const currentUrl = window.location.href;
    const currentContent = document.body.innerText;

    // Merge provided context with current page info
    const fullContext = {
      url: context?.url || currentUrl,
      pageContent: context?.pageContent || currentContent,
      wallet: context?.wallet
    };

    const requestBody = {
      message,
      context: fullContext
    };

    console.log('Preparing copilot request:', {
      messageLength: message.length,
      hasContext: true, // Will always be true now
      url: fullContext.url,
      contentLength: fullContext.pageContent.length,
      walletPrefix: fullContext.wallet ? fullContext.wallet.slice(0, 8) + '...' : 'none'
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
