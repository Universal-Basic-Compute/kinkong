export async function askKinKongCopilot(message: string, code: string, wallet?: string, screenshot?: string, mission?: string | null, submission?: string | null) {
  try {
    const requestBody = {
      message,
      code,
      wallet, // Add wallet to track conversation history properly
      mission, // Add mission to the request body
      submission, // Add submission ID to the request body
      body: document.body.innerText,
      screenshot // Base64 encoded screenshot
    };

    console.log('Sending request to copilot API with wallet:', wallet ? `${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}` : 'none');
    console.log('Mission context:', mission || 'none');
    console.log('Submission context:', submission || 'none');

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
