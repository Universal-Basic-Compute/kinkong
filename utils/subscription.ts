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

export async function verifySubscription(wallet: string): Promise<SubscriptionResponse> {
  try {
    // If no wallet is provided, return inactive subscription
    if (!wallet) {
      return { active: false };
    }
    
    const response = await fetch(`/api/subscription/check?wallet=${wallet}`);
    
    if (!response.ok) {
      console.warn(`Subscription check failed with status: ${response.status}`);
      // Return inactive subscription on error
      return { active: false };
    }
    
    const data = await response.json();
    console.log('Raw subscription data:', data);
    
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
    
    // If the API returns isActive field, normalize it to active
    if (data.isActive === true) {
      return { 
        active: true,
        subscription: data.subscription
      };
    }
    
    // Return the original data if none of the above conditions match
    return {
      ...data,
      // Ensure we always have an 'active' property for consistency
      active: data.active || false
    };
  } catch (error) {
    console.error('Subscription verification error:', error);
    // Return inactive subscription on error instead of throwing
    return { active: false };
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
