import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/utils/rate-limit';
import { getTable } from '@/backend/src/airtable/tables';
import { COPILOT_PROMPT } from '@/prompts/copilot';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

// Helper function to find and read files
async function getFileContents(pattern: string, maxFiles: number = 10, maxSizePerFile: number = 50000): Promise<string> {
  try {
    // Find files matching the pattern
    const files = await glob(pattern, { nodir: true });
    
    // Sort files by name for consistency
    files.sort();
    
    // Limit the number of files to prevent context overflow
    const limitedFiles = files.slice(0, maxFiles);
    
    let allContents = '';
    
    // Read each file and append its contents
    for (const file of limitedFiles) {
      try {
        // Read file content
        const content = await fs.readFile(file, 'utf8');
        
        // Truncate content if it's too large
        const truncatedContent = content.length > maxSizePerFile 
          ? content.substring(0, maxSizePerFile) + '\n... [content truncated due to size]' 
          : content;
        
        // Add file content with filename as header
        allContents += `\n\n--- ${file} ---\n${truncatedContent}`;
      } catch (err) {
        console.log(`Could not read file ${file}: ${err}`);
      }
    }
    
    // If we limited the files, add a note
    if (files.length > maxFiles) {
      allContents += `\n\n[Note: Only showing ${maxFiles} of ${files.length} matching files]`;
    }
    
    return allContents;
  } catch (err) {
    console.error(`Error finding files with pattern ${pattern}: ${err}`);
    return '';
  }
}

// Define interface for token discovery data
interface TokenDiscoveryData {
  activeTokens: any[];
  inactiveTokens: any[];
}

// Function to handle mission-specific context
async function handleMissionContext(mission: string | null | undefined, systemPrompt: string): Promise<string> {
  // Add specific guidance based on the mission type
  let updatedPrompt = systemPrompt;
  
  if (mission) {
    switch (mission) {
      case 'token-discovery':
        updatedPrompt += `For this token discovery mission, focus on analyzing emerging tokens on Solana with strong fundamentals. Evaluate liquidity, volume trends, and holder distribution to help the user create a watchlist of promising tokens for potential investment. Provide detailed analysis of tokenomics and market positioning when relevant.`;
        break;
      case 'portfolio-rebalancing':
        updatedPrompt += `For this portfolio rebalancing mission, help the user assess their current portfolio allocation and performance. Identify underperforming assets and potential replacements to create a step-by-step rebalancing plan based on current market conditions. Consider diversification, risk management, and market trends in your recommendations.`;
        break;
      case 'defi-yield':
        updatedPrompt += `For this DeFi yield mission, help the user discover the highest-yielding DeFi protocols on Solana. Compare risks and rewards across lending platforms and liquidity pools to develop a yield farming strategy based on the user's risk profile. Consider impermanent loss, protocol risks, and sustainable APY in your analysis.`;
        break;
      case 'swing-trading':
        updatedPrompt += `For this swing trading mission, help the user identify potential swing trading opportunities in the current market. Analyze optimal entry and exit points with specific price targets and develop a tracking system for managing multiple swing positions. Focus on risk management and technical analysis for medium-term trades.`;
        break;
      case 'strategy-optimization':
        updatedPrompt += `For this strategy optimization mission, help the user analyze and optimize KinKong's trading strategy. Focus on understanding the current algorithms, identifying bottlenecks, and suggesting improvements to enhance performance and returns. Consider both technical implementation details and strategic trading concepts.`;
        break;
      default:
        // No specific mission guidance needed
        break;
    }
  }
  
  return updatedPrompt;
}

// Function to fetch token snapshots and merge with token data
async function getTokenSnapshotsForDiscovery(): Promise<TokenDiscoveryData> {
  try {
    console.log('🔍 Fetching token snapshots for discovery mission');
    
    // Get tokens table
    const tokensTable = getTable('TOKENS');
    const tokens = await tokensTable.select({
      sort: [{ field: 'createdAt', direction: 'desc' }]
    }).all();
    
    console.log(`✅ Found ${tokens.length} tokens`);
    
    // Get token snapshots table
    const snapshotsTable = getTable('TOKEN_SNAPSHOTS');
    
    // Get latest 20 active token snapshots
    const activeSnapshots = await snapshotsTable.select({
      filterByFormula: '{isActive}=TRUE()',
      sort: [{ field: 'createdAt', direction: 'desc' }],
      maxRecords: 20
    }).all();
    
    console.log(`✅ Found ${activeSnapshots.length} active token snapshots`);
    
    // Get latest inactive token snapshots
    const inactiveSnapshots = await snapshotsTable.select({
      filterByFormula: '{isActive}=FALSE()',
      sort: [{ field: 'createdAt', direction: 'desc' }],
      maxRecords: 20
    }).all();
    
    console.log(`✅ Found ${inactiveSnapshots.length} inactive token snapshots`);
    
    // Create a map of tokens by symbol for quick lookup
    const tokenMap = new Map();
    tokens.forEach(token => {
      const symbol = token.get('token');
      if (symbol) {
        tokenMap.set(symbol, {
          token: symbol,
          name: token.get('name'),
          mint: token.get('mint'),
          isActive: token.get('isActive'),
          description: token.get('description'),
          website: token.get('website'),
          twitter: token.get('twitter'),
          telegram: token.get('telegram'),
          discord: token.get('discord'),
          createdAt: token.get('createdAt')
        });
      }
    });
    
    // Process and merge active snapshots with token data
    const processedActiveSnapshots = activeSnapshots.map(snapshot => {
      const symbol = snapshot.get('token');
      const tokenData = tokenMap.get(symbol) || {};
      
      return {
        ...tokenData,
        snapshotId: snapshot.id,
        price: snapshot.get('price'),
        marketCap: snapshot.get('marketCap'),
        volume24h: snapshot.get('volume24h'),
        volume7d: snapshot.get('volume7d'),
        liquidity: snapshot.get('liquidity'),
        holders: snapshot.get('holders'),
        volumeGrowth: snapshot.get('volumeGrowth'),
        pricePerformance: snapshot.get('pricePerformance'),
        snapshotCreatedAt: snapshot.get('createdAt'),
        isActive: true
      };
    });
    
    // Process and merge inactive snapshots with token data
    const processedInactiveSnapshots = inactiveSnapshots.map(snapshot => {
      const symbol = snapshot.get('token');
      const tokenData = tokenMap.get(symbol) || {};
      
      return {
        ...tokenData,
        snapshotId: snapshot.id,
        price: snapshot.get('price'),
        marketCap: snapshot.get('marketCap'),
        volume24h: snapshot.get('volume24h'),
        volume7d: snapshot.get('volume7d'),
        liquidity: snapshot.get('liquidity'),
        holders: snapshot.get('holders'),
        volumeGrowth: snapshot.get('volumeGrowth'),
        pricePerformance: snapshot.get('pricePerformance'),
        snapshotCreatedAt: snapshot.get('createdAt'),
        isActive: false
      };
    });
    
    return {
      activeTokens: processedActiveSnapshots,
      inactiveTokens: processedInactiveSnapshots
    };
  } catch (error) {
    console.error('❌ Error fetching token snapshots for discovery:', error);
    return { activeTokens: [], inactiveTokens: [] };
  }
}

// Helper function to format numbers with commas and abbreviate large values
function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  
  const num = parseFloat(value.toString());
  if (isNaN(num)) return '0';
  
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  } else if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  } else {
    return num.toFixed(2);
  }
}

// Define interface for user investments
interface UserInvestment {
  id: string;
  token: any;
  amount: any;
}

// Function to fetch user investments from INVESTMENTS table
async function getUserInvestments(wallet: string | undefined): Promise<UserInvestment[] | null> {
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

// Define interface for wallet portfolio
interface WalletPortfolio {
  items: any[];
  totalValue: string | number;
}

// Function to fetch wallet portfolio from Birdeye API
async function getBirdeyeWalletPortfolio(wallet: string): Promise<WalletPortfolio | null> {
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
  submission?: string | null; // Add submission ID field
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
async function checkMessageLimit(wallet: string | undefined, code: string): Promise<boolean> {
  try {
    // If no wallet is provided, fall back to checking by code
    const checkIdentifier = wallet || code;
    const filterField = wallet ? 'wallet' : 'code';
    
    // First check if code has active subscription
    const subscriptionsTable = getTable('SUBSCRIPTIONS');
    const subscriptions = await subscriptionsTable.select({
      filterByFormula: `AND(
        {code}='${code}',
        {status}='ACTIVE',
        {endDate}>=TODAY()
      )`
    }).firstPage();

    // Check if the subscription has isAdmin=true
    const isAdmin = subscriptions.length > 0 && subscriptions[0].get('isAdmin') === true;
    
    // If isAdmin is true, always return true (no message limit)
    if (isAdmin) {
      console.log('Admin subscription detected - no message limit applied');
      return true;
    }

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
    
    // Query messages from this wallet (or code if wallet not provided) in current period
    const records = await messagesTable.select({
      filterByFormula: `AND(
        {${filterField}}='${checkIdentifier}',
        IS_AFTER({createdAt}, '${periodStart.toISOString()}'),
        IS_BEFORE({createdAt}, '${periodEnd.toISOString()}')
      )`
    }).all();

    console.log(`Found ${records.length} messages for ${filterField} ${checkIdentifier} in current period`);
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
    console.error('Error checking message limit:', error);
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
        maxRecords: 20, // Last 20 messages
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
  // Define CORS headers to use throughout the function
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  };

  try {
    // Global rate limit check
    await rateLimiter.check(5, 'copilot_api');

    const requestBody: CopilotRequest = await request.json();
    const { message, code, screenshot, mission, submission } = requestBody;

    // Validate code
    if (!code) {
      return new NextResponse(
        JSON.stringify({ error: 'Code required' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // Check wallet-specific rate limit (falls back to code if no wallet)
    const isUnderLimit = await checkMessageLimit(requestBody.wallet, code);
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
          'Cache-Control': 'no-cache',
          ...corsHeaders
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
    let userData: {
      id: string;
      experience: any;
      interests: any;
      incomeSource: any;
      riskTolerance: any;
    } | null = null;
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
    let walletPortfolio: WalletPortfolio | null = null;
    if (requestBody.wallet) {
      walletPortfolio = await getBirdeyeWalletPortfolio(requestBody.wallet);
      console.log(`🔍 Wallet portfolio fetch result: ${walletPortfolio ? 'Success' : 'Failed'}`);
    }
    
    // Fetch user investments if wallet is provided
    let userInvestments: UserInvestment[] | null = null;
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

    // Fetch token snapshots if mission is token-discovery
    let tokenDiscoveryData: TokenDiscoveryData | null = null;
    if (mission === 'token-discovery') {
      tokenDiscoveryData = await getTokenSnapshotsForDiscovery();
      console.log(`🔍 Token discovery data fetch result: Active tokens: ${tokenDiscoveryData.activeTokens.length}, Inactive tokens: ${tokenDiscoveryData.inactiveTokens.length}`);
    }

    // Prepare full context with user data, wallet portfolio, investments, mission, and submission
    const fullContext = {
      request: requestBody,
      signals: contextData.signals,
      marketSentiment: contextData.marketSentiment,
      userData: userData, // Add user data to context
      walletPortfolio: walletPortfolio, // Add wallet portfolio to context
      userInvestments: userInvestments, // Add user investments to context
      investmentValues: investmentValues, // Add investment values to context
      tokenDiscoveryData: tokenDiscoveryData, // Add token discovery data to context
      mission: mission, // Add mission to context
      submission: submission // Add submission ID to context
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
      
      // Add submission context if available
      if (submission) {
        systemPrompt += `Current Submission: ${submission}\n`;
      }
      
      // If there's a submission, use that for context loading
      if (submission) {
        // Handle submission-specific context
        switch (submission) {
          case 'engine-optimization':
            // Dynamically load engine files and setup_tasks.ps1 for context
            try {
              // Load only the most important engine files with reduced size
              const engineContext = await getFileContents('engine/*.py', 5, 30000); // Reduced to 5 files and 30KB max
              
              // Add specific important files that should always be included
              const tradesContext = await getFileContents('engine/trades.py', 1, 30000);
              const tokensContext = await getFileContents('engine/tokens.py', 1, 30000);
              const signalsContext = await getFileContents('engine/signals.py', 1, 30000);
              
              // Skip setup_tasks.ps1 which might be large
              
              systemPrompt += `For this engine optimization submission, help the user analyze KinKong's trading engine implementation. Focus on understanding how the core algorithms work and identify potential optimizations for better performance and reliability.

Here are the key engine files for context:
${tradesContext}
${tokensContext}
${signalsContext}
${engineContext}`;
            } catch (err) {
              console.log(`Error loading engine files: ${err}`);
              systemPrompt += `For this engine optimization submission, help the user analyze KinKong's trading engine implementation. Focus on understanding how the core algorithms work and identify potential optimizations for better performance and reliability.`;
            }
            break;
          
          case 'trades-optimization':
            // For trades optimization, load token discovery data instead of engine files
            try {
              // Fetch token snapshots for discovery (similar to token-discovery mission)
              const tokenDiscoveryData = await getTokenSnapshotsForDiscovery();
              
              // Only include active tokens - limit to top 5 instead of 10
              const activeTokensContext = tokenDiscoveryData && tokenDiscoveryData.activeTokens 
                ? `Active Tokens (${tokenDiscoveryData.activeTokens.length}):
${tokenDiscoveryData.activeTokens
  .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
  .slice(0, 5) // Reduced from 10 to 5
  .map((token, index) => 
    `${index + 1}. ${token.token} (${token.name || 'Unknown'}): $${parseFloat(token.price || 0).toFixed(6)}, Market Cap: $${formatNumber(token.marketCap)}, Volume 24h: $${formatNumber(token.volume24h)}`
  ).join('\n')}`
                : 'No active tokens data available';
              
              systemPrompt += `For this trades optimization submission, help the user optimize the trading aspects of KinKong's strategy. Focus on analyzing entry/exit decisions, trade execution, and market adaptation to improve overall returns.

Here is the current active token data for context:

${activeTokensContext}`;
            } catch (err) {
              console.log(`Error loading trades optimization data: ${err}`);
              systemPrompt += `For this trades optimization submission, help the user optimize the trading aspects of KinKong's strategy. Focus on analyzing entry/exit decisions, trade execution, and market adaptation to improve overall returns.`;
            }
            break;
          
          case 'socials-optimization':
            // Dynamically load socials files for context
            try {
              // Limit file count and size
              const socialsContext = await getFileContents('socials/**/*.py', 5, 30000);
              
              systemPrompt += `For this socials optimization submission, help the user review KinKong's social media integration and sentiment analysis. Focus on optimizing how we gather, process, and act on social signals to improve trading decisions.

Here are the key socials-related files for context:${socialsContext}`;
            } catch (err) {
              console.log(`Error loading socials files: ${err}`);
              systemPrompt += `For this socials optimization submission, help the user review KinKong's social media integration and sentiment analysis. Focus on optimizing how we gather, process, and act on social signals to improve trading decisions.`;
            }
            break;
          
          case 'whales-optimization':
            // Dynamically load whales files for context
            try {
              // Limit file count and size
              const whalesContext = await getFileContents('engine/whales/**/*.py', 5, 30000);
              
              systemPrompt += `For this whales optimization submission, help the user optimize KinKong's whale tracking and analysis capabilities. Focus on better identifying and following smart money movements to improve our strategy.

Here are the key whales-related files for context:${whalesContext}`;
            } catch (err) {
              console.log(`Error loading whales files: ${err}`);
              systemPrompt += `For this whales optimization submission, help the user optimize KinKong's whale tracking and analysis capabilities. Focus on better identifying and following smart money movements to improve our strategy.`;
            }
            break;
          
          default:
            // If no specific submission handler, fall back to mission-based context
            systemPrompt = await handleMissionContext(mission, systemPrompt);
        }
      } else {
        // If no submission, use mission-based context
        systemPrompt = await handleMissionContext(mission, systemPrompt);
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

Total Portfolio Value: $${parseFloat(walletPortfolio.totalValue?.toString() || '0').toFixed(2)}

Use this information to provide personalized advice relevant to their current holdings.`;
    }
    
    // Add user investments to system prompt if available and mission is portfolio-rebalancing
    if (mission === 'portfolio-rebalancing' && userInvestments && userInvestments.length > 0) {
      systemPrompt += `\n\nUser's KinKong Investments:
Total Investment Value: $${investmentValues.totalInvestmentValue.toFixed(2)}
Percentage of Portfolio Managed: ${investmentValues.managedPercentage.toFixed(2)}%

Use this investment data to provide specific rebalancing recommendations based on the user's current KinKong Invest allocations, market conditions, and risk tolerance.`;
    }
    
    // Add token discovery data to system prompt if available and mission is token-discovery
    if (mission === 'token-discovery' && tokenDiscoveryData) {
      systemPrompt += `\n\nToken Discovery Data:
You have access to data on ${tokenDiscoveryData.activeTokens.length} active tokens and ${tokenDiscoveryData.inactiveTokens.length} inactive tokens.

Active Tokens (Top 5 by Market Cap):
${tokenDiscoveryData.activeTokens
.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
.slice(0, 5)
.map((token, index) => 
  `${index + 1}. ${token.token} (${token.name || 'Unknown'}): $${parseFloat(token.price || 0).toFixed(6)}, Market Cap: $${formatNumber(token.marketCap)}, Volume 24h: $${formatNumber(token.volume24h)}, Liquidity: $${formatNumber(token.liquidity)}`
).join('\n')}

Active Tokens (Top 5 by Volume Growth):
${tokenDiscoveryData.activeTokens
.sort((a, b) => (b.volumeGrowth || 0) - (a.volumeGrowth || 0))
.slice(0, 5)
.map((token, index) => 
  `${index + 1}. ${token.token} (${token.name || 'Unknown'}): Volume Growth: ${(token.volumeGrowth || 0).toFixed(2)}%, Price Performance: ${(token.pricePerformance || 0).toFixed(2)}%, Holders: ${formatNumber(token.holders)}`
).join('\n')}

Recently Inactive Tokens:
${tokenDiscoveryData.inactiveTokens
.slice(0, 3)
.map((token, index) => 
  `${index + 1}. ${token.token} (${token.name || 'Unknown'}): Last Price: $${parseFloat(token.price || 0).toFixed(6)}, Last Volume: $${formatNumber(token.volume24h)}`
).join('\n')}

Use this token data to help the user discover promising tokens, analyze market trends, and make informed investment decisions.`;
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
    const timeoutId = setTimeout(() => controller.abort(), 30000); // Reduce timeout to 30 seconds

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
    } catch (innerError) {
      clearTimeout(timeoutId);

      if (innerError instanceof Error && innerError.name === 'AbortError') {
        return new NextResponse(
          JSON.stringify({
            error: 'Request timeout after 60 seconds',
            details: 'The request took too long to complete. Try again with a shorter message or without a screenshot.'
          }),
          {
            status: 408,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          }
        );
      }

      throw innerError;
    }
  } catch (outerError) {
    console.error('❌ Copilot error:', {
      name: outerError instanceof Error ? outerError.name : 'Unknown',
      message: outerError instanceof Error ? outerError.message : 'Unknown error',
      stack: outerError instanceof Error ? outerError.stack : undefined
    });

    return new NextResponse(
      JSON.stringify({
        error: 'Failed to process request',
        details: outerError instanceof Error ? outerError.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400' // 24 hours
    }
  });
}
