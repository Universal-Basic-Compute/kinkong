export async function askKinKongCopilot(message: string, context?: any) {
  try {
    // Simplify the context structure to match what the API expects
    const requestBody = {
      message,
      context: {
        url: context?.url || window.location.href,
        pageContent: context?.pageContent || document.body.innerText,
        wallet: context?.wallet
      }
    };

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
