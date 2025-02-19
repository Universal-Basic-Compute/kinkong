interface CopilotContext {
  marketSentiment?: string;
  portfolioValue?: number;
  topHoldings?: string[];
  recentTrades?: string;
}

export async function askKinKongCopilot(
  message: string, 
  context?: CopilotContext
) {
  try {
    const response = await fetch('/api/copilot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        context
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
