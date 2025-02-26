require('dotenv').config();
const fetch = require('node-fetch');

async function sendTestNotification() {
  try {
    // Check for API key
    const apiKey = process.env.NOTIFICATION_API_KEY;
    if (!apiKey) {
      console.error('❌ Error: NOTIFICATION_API_KEY not found in environment variables');
      process.exit(1);
    }

    console.log('🔔 Sending test notification to KinKong Copilot...');

    // Create a test notification
    const testNotification = {
      type: 'SIGNAL_CREATED',
      data: {
        id: 'test-signal-123',
        token: 'TEST',
        direction: 'BUY',
        timeframe: 'SCALP',
        entryPrice: '1.25',
        targetPrice: '1.50',
        stopLoss: '1.15',
        confidence: 'HIGH',
        reason: 'This is a test notification from the test script',
        createdAt: new Date().toISOString()
      }
    };

    // Send the notification
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/notifications/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(testNotification)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Test notification sent successfully!');
      console.log(result);
    } else {
      console.error('❌ Failed to send test notification:', result.error);
    }
  } catch (error) {
    console.error('❌ Error sending test notification:', error);
  }
}

// Execute the function
sendTestNotification();
