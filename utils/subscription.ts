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
    const response = await fetch(`/api/subscription/check?code=${code}`);
    if (!response.ok) throw new Error('Failed to verify subscription');
    
    const data = await response.json();
    console.log('Raw subscription data:', data); // Log the raw data for debugging
    
    // If the API returns a status field directly, handle it
    if (data.status && data.status === 'ACTIVE') {
      return { active: true };
    }
    
    // If the API returns a subscription object with a status field, handle it
    if (data.subscription && data.subscription.status === 'ACTIVE') {
      return {
        active: true,
        subscription: data.subscription
      };
    }
    
    // Return the original data if none of the above conditions match
    return data;
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
