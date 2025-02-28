import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/utils/rate-limit';
import { getTable } from '@/backend/src/airtable/tables';
import { COPILOT_PROMPT } from '@/prompts/copilot';

// Function to fetch user investments from INVESTMENTS table
async function getUserInvestments(wallet: string | undefined) {
  if (!wallet) {
    console.log('No wallet provided, skipping investments fetch');
    return null;
  }
  
  try {
    console.log(`🔍 Fetching investments for wallet: ${wallet}`);
    const investmentsTable = getTable('INVESTMENTS');
    
    const records = await investmentsTable.select({
      filterByFormula: `{wallet}='${wallet}'`,
      sort: [{ field: 'createdAt', direction: 'desc' }]
    }).all();
    
    console.log(`✅ Found ${records.length} investment records for wallet ${wallet}`);
    
    if (records.length === 0) {
      return null;
    }
    
    // Only return token and amount fields
    return records.map(record => ({
      id: record.id,
      token: record.get('token'),
      amount: record.get('amount')
    }));
  } catch (error) {
    console.error('❌ Error fetching user investments:', error);
    return null;
  }
}

// Function to calculate the total value of user's investments and managed percentage
async function calculateInvestmentValue(userInvestments: any[], walletPortfolio: any) {
  if (!userInvestments || !walletPortfolio) {
    return { totalInvestmentValue: 0, managedPercentage: 0 };
  }
  
  try {
    console.log(`🔍 Calculating investment values for ${userInvestments.length} investments`);
    
    // Get token prices from wallet portfolio for calculation
    const tokenPrices: Record<string, number> = {};
    
    if (walletPortfolio.items && walletPortfolio.items.length > 0) {
      walletPortfolio.items.forEach((item: any) => {
        if (item.symbol && item.price) {
          tokenPrices[item.symbol.toUpperCase()] = parseFloat(item.price);
        }
      });
    }
    
    console.log(`Found prices for ${Object.keys(tokenPrices).length} tokens in wallet`);
    
    // Calculate total investment value
    let totalInvestmentValue = 0;
    
    for (const investment of userInvestments) {
      const token = investment.token?.toUpperCase();
      const amount = parseFloat(investment.amount || 0);
      
      if (token && amount > 0 && tokenPrices[token]) {
        const tokenValue = amount * tokenPrices[token];
        totalInvestmentValue += tokenValue;
      }
    }
    
    // Calculate managed percentage
    const totalWalletValue = parseFloat(walletPortfolio.totalValue || 0);
    const managedPercentage = totalWalletValue > 0 
      ? (totalInvestmentValue / totalWalletValue) * 100 
      : 0;
    
    console.log(`Total investment value: $${totalInvestmentValue.toFixed(2)}`);
    console.log(`Total wallet value: $${totalWalletValue.toFixed(2)}`);
    console.log(`Managed percentage: ${managedPercentage.toFixed(2)}%`);
    
    return { 
      totalInvestmentValue, 
      managedPercentage 
    };
  } catch (error) {
    console.error('❌ Error calculating investment values:', error);
    return { totalInvestmentValue: 0, managedPercentage: 0 };
  }
}

// Function to fetch wallet portfolio from Birdeye API
async function getBirdeyeWalletPortfolio(wallet: string) {
  try {
    console.log(`🔍 Fetching Birdeye wallet portfolio for: ${wallet}`);
    const apiKey = process.env.BIRDEYE_API_KEY;
    
    if (!apiKey) {
      console.warn('BIRDEYE_API_KEY not found in environment variables');
      return null;
    }
    
    const response = await fetch(`https://public-api.birdeye.so/v1/wallet/token_list?wallet=${wallet}`, {
      headers: {
        'x-api-key': apiKey,
        'x-chain': 'solana'
      }
    });
    
    if (!response.ok) {
      console.error(`Birdeye API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`✅ Successfully fetched wallet portfolio with ${data.data?.items?.length || 0} tokens`);
    return data.data;
  } catch (error) {
    console.error('❌ Error fetching Birdeye wallet portfolio:', error);
    return null;
  }
}

// Interface for the copilot request
interface CopilotRequest {
  message: string;
  code: string;
  wallet?: string;
  screenshot?: string; // Base64 encoded image
  mission?: string | null; // Add mission field
}

const RATE_LIMIT_MESSAGES = [
  `Time for a quick break! 🎯 Hit my message limit. Want more trading insights? [Premium awaits](https://swarmtrade.ai/copilot)! 🚀\n\nKinKong will be back tomorrow! 🕒`,
  
  `Whew, what a chat! 💬 Need to recharge for a bit. Get more trading insights with [premium](https://swarmtrade.ai/copilot) ✨\n\nKinKong will be back tomorrow! 🕒`,
  
  `Hold that thought! 🤔 Daily message limit reached. Want more trading chats? Join [premium](https://swarmtrade.ai/copilot) 💪\n\nKinKong will be back tomorrow! 🕒`,
  
  `Taking a breather! 😅 Max messages hit. Want more trading time? [Upgrade here](https://swarmtrade.ai/copilot) 🎓\n\nKinKong will be back tomorrow! 🕒`,
  
  `Energy check! ⚡ Need to rest my circuits. Want more trading convos? [Premium's calling](https://swarmtrade.ai/copilot) 🌟\n\nKinKong will be back tomorrow! 🕒`
];

// Initialize global rate limiter
const rateLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
});

// Helper function to check wallet message limit
async function checkMessageLimit(code: string): Promise<boolean> {
  try {
    // First check if code has active subscription
    const subscriptionsTable = getTable('SUBSCRIPTIONS');
    const subscriptions = await subscriptionsTable.select({
      filterByFormula: `AND(
        {code}='${code}',
        {status}='ACTIVE',
        {endDate}>=TODAY()
      )`
    }).firstPage();

    // If has active subscription, allow 100 messages per block
    // If free tier, allow 10 messages per day
    const isPremium = subscriptions.length > 0;
    const messageLimit = isPremium ? 100 : 10;

    // For premium users, check 8-hour block
    // For free users, check daily limit
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;
    
    if (isPremium) {
      // Calculate current 8-hour block for premium users
      const blockNumber = Math.floor(now.getUTCHours() / 8);
      periodStart = new Date(now);
      periodStart.setUTCHours(blockNumber * 8, 0, 0, 0); // Start of current 8-hour block
      periodEnd = new Date(periodStart);
      periodEnd.setUTCHours(periodStart.getUTCHours() + 8); // End of current 8-hour block
    } else {
      // Calculate current day for free users
      periodStart = new Date(now);
      periodStart.setUTCHours(0, 0, 0, 0); // Start of current day
      periodEnd = new Date(periodStart);
      periodEnd.setUTCHours(24, 0, 0, 0); // End of current day
    }

    const messagesTable = getTable('MESSAGES');
    
    // Query messages from this code in current period
    const records = await messagesTable.select({
      filterByFormula: `AND(
        {code}='${code}',
        IS_AFTER({createdAt}, '${periodStart.toISOString()}'),
        IS_BEFORE({createdAt}, '${periodEnd.toISOString()}')
      )`
    }).all();

    console.log(`Found ${records.length} messages for code ${code} in current period`);
    console.log(`Period: ${periodStart.toISOString()} - ${periodEnd.toISOString()}`);
    console.log(`Code has active subscription: ${isPremium}`);
    console.log(`Message limit: ${messageLimit}`);
    console.log(`Messages used in current period: ${records.length}`);
    
    if (isPremium) {
      console.log(`Time until next block: ${new Date(periodEnd).getTime() - now.getTime()}ms`);
    } else {
      console.log(`Time until next day: ${new Date(periodEnd).getTime() - now.getTime()}ms`);
    }

    return records.length < messageLimit; // Return true if under limit
  } catch (error) {
    console.error('Error checking wallet message limit:', error);
    throw error;
  }
}

async function getContextData(code: string) {
  try {
    // Get last 25 signals
    const signalsTable = getTable('SIGNALS');
    const signals = await signalsTable
      .select({
        maxRecords: 25,
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .all();
    console.log(`📊 Found ${signals.length} signals`);

    // Get latest market sentiment
    const sentimentTable = getTable('MARKET_SENTIMENT');
    const sentiment = await sentimentTable
      .select({
        maxRecords: 1,
        sort: [{ field: 'weekEndDate', direction: 'desc' }]
      })
      .firstPage();
    console.log('🎯 Market sentiment found:', !!sentiment.length);

    // Get recent messages for this code
    console.log(`🔍 Fetching messages for code: ${code}`);
    const messagesTable = getTable('MESSAGES');
    const messages = await messagesTable
      .select({
        filterByFormula: `{code}='${code}'`,
        maxRecords: 10, // Last 10 messages
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .all();
    console.log(`💬 Found ${messages.length} messages for code ${code}`);
    console.log('Message details:', messages.map(m => ({
      role: m.get('role'),
      createdAt: m.get('createdAt'),
      contentPreview: (m.get('content') as string).substring(0, 50) + '...'
    })));

    return {
      signals: signals.map(record => ({
        token: record.get('token'),
        type: record.get('type'),
        timeframe: record.get('timeframe'),
        confidence: record.get('confidence'),
        reason: record.get('reason'),
        createdAt: record.get('createdAt'),
        actualReturn: record.get('actualReturn'),
        success: record.get('success')
      })),
      marketSentiment: sentiment.length > 0 ? {
        classification: sentiment[0].get('classification'),
        confidence: sentiment[0].get('confidence'),
        tokensAbove7dAvg: sentiment[0].get('tokensAbove7dAvg'),
        totalTokens: sentiment[0].get('totalTokens'),
        solPerformance: sentiment[0].get('solPerformance'),
        aiTokensPerformance: sentiment[0].get('aiTokensPerformance'),
        notes: sentiment[0].get('notes'),
        weekEndDate: sentiment[0].get('weekEndDate')
      } : null,
      conversationHistory: messages.map(record => ({
        role: record.get('role'),
        content: record.get('content'),
        createdAt: record.get('createdAt')
      })).reverse() // Reverse to get chronological order
    };
  } catch (error) {
    console.error('❌ Error fetching context data:', error);
    return { signals: [], marketSentiment: null, conversationHistory: [] };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Global rate limit check
    await rateLimiter.check(5, 'copilot_api');

    const requestBody: CopilotRequest = await request.json();
    const { message, code, screenshot, mission } = requestBody;

    // Validate code
    if (!code) {
      return new NextResponse(
        JSON.stringify({ error: 'Code required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Check code-specific rate limit
    const isUnderLimit = await checkMessageLimit(code);
    if (!isUnderLimit) {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const randomMessage = RATE_LIMIT_MESSAGES[Math.floor(Math.random() * RATE_LIMIT_MESSAGES.length)];
          controller.enqueue(encoder.encode(randomMessage));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not found in environment');
      throw new Error('API key configuration missing');
    }

    console.log('API Key check:', {
      present: !!apiKey,
      prefix: apiKey.substring(0, 7),
      length: apiKey.length
    });

    // Get context data
    const contextData = await getContextData(code);
    
    // Fetch user data if wallet is provided
    let userData = null;
    if (requestBody.wallet) {
      try {
        console.log(`🔍 Fetching user data for wallet: ${requestBody.wallet}`);
        const usersTable = getTable('USERS');
        const users = await usersTable.select({
          filterByFormula: `{wallet}='${requestBody.wallet}'`
        }).firstPage();
    
        if (users.length > 0) {
          userData = {
            id: users[0].id,
            experience: users[0].get('experience'),
            interests: users[0].get('interests'),
            incomeSource: users[0].get('incomeSource'),
            riskTolerance: users[0].get('riskTolerance')
          };
          console.log('👤 Found user data:', userData);
        } else {
          console.log('⚠️ No user found for wallet:', requestBody.wallet);
        }
      } catch (error) {
        console.error('❌ Error fetching user data:', error);
      }
    }

    // Fetch wallet portfolio from Birdeye if wallet is provided
    let walletPortfolio = null;
    if (requestBody.wallet) {
      walletPortfolio = await getBirdeyeWalletPortfolio(requestBody.wallet);
      console.log(`🔍 Wallet portfolio fetch result: ${walletPortfolio ? 'Success' : 'Failed'}`);
    }
    
    // Fetch user investments if wallet is provided
    let userInvestments = null;
    if (requestBody.wallet) {
      userInvestments = await getUserInvestments(requestBody.wallet);
      console.log(`🔍 User investments fetch result: ${userInvestments ? `Success (${userInvestments.length} investments)` : 'No investments found'}`);
    }

    // Calculate investment values and managed percentage if we have both investments and wallet portfolio
    let investmentValues = { totalInvestmentValue: 0, managedPercentage: 0 };
    if (userInvestments && walletPortfolio) {
      investmentValues = await calculateInvestmentValue(userInvestments, walletPortfolio);
      console.log(`🔍 Investment calculation result: $${investmentValues.totalInvestmentValue.toFixed(2)} (${investmentValues.managedPercentage.toFixed(2)}% of wallet)`);
    }

    // Prepare full context with user data, wallet portfolio, investments, and mission
    const fullContext = {
      request: requestBody,
      signals: contextData.signals,
      marketSentiment: contextData.marketSentiment,
      userData: userData, // Add user data to context
      walletPortfolio: walletPortfolio, // Add wallet portfolio to context
      userInvestments: userInvestments, // Add user investments to context
      investmentValues: investmentValues, // Add investment values to context
      mission: mission // Add mission to context
    };

    const bodyContent = JSON.stringify(fullContext);

    let systemPrompt = COPILOT_PROMPT;
    
    // Add explanation about the screenshot to the system prompt if one is provided
    if (screenshot) {
      systemPrompt += `\n\nYou have access to a screenshot of the webpage the user is currently viewing. This screenshot is included in the user's message to help you understand the context of their question or request. Reference visual elements from the screenshot when relevant to your response.`;
    }
    
    // Add mission context to the system prompt if available
    if (mission) {
      // Add mission-specific guidance to the existing system prompt
      systemPrompt += `\n\nCurrent Mission: ${mission}\n`;
      
      // Add specific guidance based on the mission type
      switch (mission) {
        case 'token-discovery':
          systemPrompt += `For this token discovery mission, focus on analyzing emerging tokens on Solana with strong fundamentals. Evaluate liquidity, volume trends, and holder distribution to help the user create a watchlist of promising tokens for potential investment. Provide detailed analysis of tokenomics and market positioning when relevant.`;
          break;
        case 'portfolio-rebalancing':
          systemPrompt += `For this portfolio rebalancing mission, help the user assess their current portfolio allocation and performance. Identify underperforming assets and potential replacements to create a step-by-step rebalancing plan based on current market conditions. Consider diversification, risk management, and market trends in your recommendations.`;
          break;
        case 'technical-analysis':
          systemPrompt += `For this technical analysis workshop, help the user identify key chart patterns on specific tokens. Guide them in practicing support/resistance identification and developing a personalized trading strategy based on technical indicators. Explain concepts clearly and relate them to current market conditions.`;
          break;
        case 'risk-management':
          systemPrompt += `For this risk management optimization mission, help the user evaluate their position sizing and stop-loss strategies. Calculate optimal risk-reward ratios based on volatility and create a risk management framework aligned with the user's risk tolerance. Emphasize capital preservation while maximizing returns.`;
          break;
        case 'defi-yield':
          systemPrompt += `For this DeFi yield optimization mission, help the user discover the highest-yielding DeFi protocols on Solana. Compare risks and rewards across lending platforms and liquidity pools to develop a yield farming strategy based on the user's risk profile. Consider impermanent loss, protocol risks, and sustainable APY.`;
          break;
        case 'sentiment-analysis':
          systemPrompt += `For this market sentiment analysis mission, help the user track social media trends and community sentiment for key tokens. Focus on correlating sentiment indicators with price action and creating alerts for significant sentiment shifts that could impact prices. Consider Twitter, Discord, and Telegram as primary sources.`;
          break;
        case 'swing-trading':
          systemPrompt += `For this swing trading setup mission, help the user identify potential swing trading opportunities in the current market. Analyze optimal entry and exit points with specific price targets and develop a tracking system for managing multiple swing positions. Focus on medium-term price movements and key levels.`;
          break;
        case 'on-chain-data':
          systemPrompt += `For this on-chain data investigation mission, help the user explore whale wallet movements and smart money flows. Analyze token distribution and concentration metrics to identify potential accumulation or distribution patterns before they affect price. Focus on on-chain indicators of future price movements.`;
          break;
        default:
          systemPrompt += `For this mission, provide personalized trading and investment advice based on the user's preferences and the current market conditions.`;
      }
    }

    // Update system prompt to include user preferences if available
    if (userData) {
      systemPrompt += `\n\nUser Preferences:
- Experience Level: ${userData.experience || 'Not specified'}
- Trading Interests: ${userData.interests || 'Not specified'}
- Income Source: ${userData.incomeSource || 'Not specified'}
- Risk Tolerance: ${userData.riskTolerance || 'Not specified'}

Tailor your responses to match this user's experience level, interests, and risk tolerance. For ${userData.experience || 'unspecified'} traders, ${getExperienceLevelGuidance(userData.experience)}`;
    }

    // Add wallet portfolio information to system prompt if available
    if (walletPortfolio && walletPortfolio.items && walletPortfolio.items.length > 0) {
      systemPrompt += `\n\nUser's Wallet Portfolio:
The user's wallet contains ${walletPortfolio.items.length} tokens. Here are the top holdings:
${walletPortfolio.items.slice(0, 10).map((item: any, index: number) => 
  `${index + 1}. ${item.symbol || 'Unknown'}: $${parseFloat(item.value || 0).toFixed(2)} (${item.percentage ? (item.percentage * 100).toFixed(2) : '0'}%)`
).join('\n')}

Total Portfolio Value: $${parseFloat(walletPortfolio.totalValue || 0).toFixed(2)}

Use this information to provide personalized advice relevant to their current holdings.`;
    }
    
    // Add user investments to system prompt if available and mission is portfolio-rebalancing
    if (mission === 'portfolio-rebalancing' && userInvestments && userInvestments.length > 0) {
      systemPrompt += `\n\nUser's KinKong Investments:
The user has ${userInvestments.length} managed investments in KinKong Invest:
${userInvestments.map((investment: any, index: number) => {
  const amount = parseFloat(investment.amount || 0);
  return `${index + 1}. ${investment.token}: ${amount} tokens`;
}).join('\n')}

Total Investment Value: $${investmentValues.totalInvestmentValue.toFixed(2)}
Percentage of Portfolio Managed: ${investmentValues.managedPercentage.toFixed(2)}%

Use this investment data to provide specific rebalancing recommendations based on the user's current KinKong Invest allocations, market conditions, and risk tolerance.`;
    }

    // Helper function to get guidance based on experience level
    function getExperienceLevelGuidance(experience: string | null | undefined): string {
      switch (experience) {
        case 'beginner':
          return 'explain concepts thoroughly, avoid jargon, and focus on educational content with lower-risk strategies.';
        case 'intermediate':
          return 'provide more detailed analysis, introduce moderate strategies, and include some technical concepts with explanations.';
        case 'advanced':
          return 'offer sophisticated analysis, discuss complex strategies, and use technical terminology freely.';
        case 'professional':
          return 'provide high-level insights, discuss advanced trading concepts, and focus on professional-grade analysis.';
        default:
          return 'balance explanations with insights, and adjust technical depth based on the conversation context.';
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      // Prepare messages array with conversation history
      const messages = [
        ...contextData.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];
      
      // Add the current message with screenshot if available
      if (screenshot) {
        // Add the message with both text and image
        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: message
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: screenshot.replace(/^data:image\/[a-z]+;base64,/, '') // Remove data URL prefix if present
              }
            }
          ]
        });
      } else {
        // Add text-only message if no screenshot
        messages.push({
          role: 'user',
          content: message
        });
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: "claude-3-7-sonnet-20250219",
          max_tokens: 1024,
          messages: messages,
          system: `${systemPrompt}\n\nPage Content:\n${bodyContent}`
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      console.log('Sending messages to Claude:', {
        historyCount: contextData.conversationHistory.length,
        messages: [
          ...contextData.conversationHistory.map(msg => ({
            role: msg.role,
            contentPreview: msg.content.substring(0, 50) + '...'
          })),
          { role: 'user', contentPreview: message.substring(0, 50) + '...' }
        ]
      });

      const data = await response.json();
      const assistantMessage = data.content[0].text;

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(assistantMessage));
          controller.close();
        }
      });

      if (code) {
        const messagesTable = getTable('MESSAGES');
        
        // Create user message record - store screenshot info in notes if present
        const userMessageFields = {
          code,
          role: 'user',
          content: message,
          createdAt: new Date().toISOString(),
          wallet: requestBody.wallet || null,
          notes: screenshot ? 'Contains screenshot' : null
        };
        
        // Create assistant message record
        const assistantMessageFields = {
          code,
          role: 'assistant',
          content: assistantMessage,
          createdAt: new Date().toISOString(),
          wallet: requestBody.wallet || null
        };
        
        await messagesTable.create([
          { fields: userMessageFields },
          { fields: assistantMessageFields }
        ]);
      }

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return new NextResponse(
          JSON.stringify({
            error: 'Request timeout after 30 seconds',
            details: 'The request took too long to complete'
          }),
          {
            status: 408,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('❌ Copilot error:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return new NextResponse(
      JSON.stringify({
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
