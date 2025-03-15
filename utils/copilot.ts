export async function askKinKongCopilot(message: string, wallet?: string, screenshot?: string, mission?: string | null, submission?: string | null) {
  try {
    const requestBody = {
      message,
      code: 'default', // Add default code
      wallet, // Add wallet to track conversation history properly
      mission, // Add mission to the request body
      submission, // Add submission ID to the request body
      body: document.body.innerText,
      screenshot // Base64 encoded screenshot
    };

    console.log('Sending request to copilot API with wallet:', wallet ? `${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}` : 'none');
    console.log('Mission context:', mission || 'none');
    console.log('Submission context:', submission || 'none');

    // Create an AbortController with a longer timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout

    try {
      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      // Clear the timeout
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
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
      clearTimeout(timeoutId);
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Request timed out after 90 seconds. Please try again with a shorter message or without a screenshot.');
      }
      
      throw error;
    }
  } catch (error) {
    console.error('Error asking KinKong-copilot:', error);
    if (error instanceof Error) {
      throw error; // Preserve the original error message
    } else {
      throw new Error('Failed to get copilot response');
    }
  }
}
