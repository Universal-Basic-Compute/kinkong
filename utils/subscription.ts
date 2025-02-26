interface SubscriptionResponse {
  active: boolean;
  subscription?: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  error?: string;
}

export async function verifySubscription(code: string): Promise<SubscriptionResponse> {
  try {
    const response = await fetch(`/api/subscription?code=${code}`);
    if (!response.ok) throw new Error('Failed to verify subscription');
    return await response.json();
  } catch (error) {
    console.error('Subscription verification error:', error);
    throw error;
  }
}

export async function createSubscription(
  signature: string, 
  wallet: string, 
  code: string,
  paymentMethod: string = 'SOL',
  durationDays: number = 90
) {
  try {
    const response = await fetch('/api/subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        signature,
        wallet,
        code,
        paymentMethod,
        durationDays
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create subscription');
    }

    return await response.json();
  } catch (error) {
    console.error('Subscription creation error:', error);
    throw error;
  }
}
