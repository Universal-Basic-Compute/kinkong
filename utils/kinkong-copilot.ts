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
    const response = await fetch('/api/kinkong-copilot', {
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

    const data = await response.json();
    return data.response;

  } catch (error) {
    console.error('Error asking KinKong-copilot:', error);
    throw error;
  }
}
