'use client';
import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { InvestmentsTable } from '@/components/invest/InvestmentsTable';
import { RedistributionsTable } from '@/components/invest/InvestorsTable';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TokenDisplay } from '@/utils/tokenDisplay';
import { YourInvestments } from '@/components/dashboard/YourInvestments';

// Function to send Telegram notifications
async function sendTelegramNotification(investmentData: any) {
  try {
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const chatId = "-1001699255893"; // The specified chat ID
    
    if (!botToken) {
      console.warn("Telegram bot token not found in environment variables");
      return false;
    }
    
    // Format wallet address for display
    const wallet = investmentData.wallet;
    const walletDisplay = wallet.substring(0, 10) + '...' + wallet.substring(wallet.length - 10);
    
    // Create message text (removed percentage)
    const message = `🚀 *New KinKong Investment*
    
💰 *Amount*: ${investmentData.amount.toLocaleString()} ${investmentData.token}
👤 *Investor*: \`${walletDisplay}\`
⏱ *Date*: ${new Date().toLocaleString()}

🔗 [View Transaction](${investmentData.solscanUrl})
`;
    
    // Send the image with caption
    try {
      // First try to send with image
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('caption', message);
      formData.append('parse_mode', 'Markdown');
      
      // Fetch the image and append it to the form
      const imageResponse = await fetch('/copilot.png');
      const imageBlob = await imageResponse.blob();
      formData.append('photo', imageBlob, 'copilot.png');
      
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }
    } catch (imageError) {
      console.warn('Failed to send image, falling back to text-only message', imageError);
      
      // Fallback to text-only message if image fails
      const textResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        }),
      });
      
      if (!textResponse.ok) {
        throw new Error(`Telegram API error: ${textResponse.status}`);
      }
    }
    
    console.log('Telegram notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return false;
  }
}

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Mainnet USDC
const UBC_MINT = new PublicKey('9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump'); // UBC token
const COMPUTE_MINT = new PublicKey('B1N1HcMm4RysYz4smsXwmk2UnS8NziqKCM6Ho8i62vXo'); // COMPUTE token
const TREASURY_WALLET = new PublicKey('FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY');

interface TokenPrice {
  price: number;
  timestamp: number;
}

interface Investment {
  investmentId: string;
  amount: number;
  token?: string; // Token type (UBC, COMPUTE, USDC)
  usdAmount?: number; // USD equivalent amount
  solscanUrl: string;
  date: string;
  username?: string;
  wallet: string;
  return?: number; // USDC return
  ubcReturn?: number; // UBC return
}

interface WalletSnapshot {
  totalValue: number;
  timestamp: string;
}

// Function to fetch UBC price from DexScreener
async function getUbcPrice(): Promise<number> {
  try {
    console.log('Fetching UBC price from DexScreener...');
    
    // Use DexScreener API to get the UBC price
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${UBC_MINT.toString()}`);
    
    if (!response.ok) {
      console.error(`DexScreener API error: ${response.status}`);
      throw new Error(`DexScreener API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('DexScreener API response:', data);
    
    if (data.pairs && data.pairs.length > 0) {
      // Find the most liquid Solana pair
      const solPairs = data.pairs.filter((pair: any) => pair.chainId === 'solana');
      if (solPairs.length > 0) {
        // Sort by liquidity and get the most liquid pair
        const bestPair = solPairs.sort((a: any, b: any) => 
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];
        
        const price = parseFloat(bestPair.priceUsd);
        console.log('UBC price from DexScreener:', price);
        return price;
      }
    }
    
    console.error('No valid pairs found in DexScreener response:', data);
    throw new Error('No valid pairs found in DexScreener response');
  } catch (error) {
    console.error('Failed to fetch UBC price:', error);
    // Return a fallback price for testing
    const fallbackPrice = 0.0001; // $0.0001 per UBC
    console.log(`Using fallback UBC price: ${fallbackPrice}`);
    return fallbackPrice;
  }
}

// Function to fetch COMPUTE price from specific Meteora pool
async function getComputePrice(): Promise<number> {
  try {
    console.log('Fetching COMPUTE price from DexScreener Meteora pool...');
    
    // Use DexScreener API to get the specific Meteora pool
    const poolAddress = 'HN7ibjiyX399d1EfYXcWaSHZRSMfUmonYvXGFXG41Rr3';
    const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${poolAddress}`);
    
    if (!response.ok) {
      console.error(`DexScreener API error: ${response.status}`);
      throw new Error(`DexScreener API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('DexScreener Meteora pool response:', data);
    
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      const price = parseFloat(pair.priceUsd);
      console.log('COMPUTE price from Meteora pool:', price);
      return price;
    }
    
    console.error('No valid pair found in DexScreener response:', data);
    throw new Error('No valid pair found in DexScreener response');
  } catch (error) {
    console.error('Failed to fetch COMPUTE price:', error);
    // Return a fallback price for testing
    const fallbackPrice = 0.00001; // $0.00001 per COMPUTE
    console.log(`Using fallback COMPUTE price: ${fallbackPrice}`);
    return fallbackPrice;
  }
}


// Add a function to convert token amounts to USD
async function convertTokensToUSD(investments: Investment[], ubcPrice: number, computePrice: number): Promise<Investment[]> {
  return investments.map(investment => {
    const token = investment.token || 'USDC'; // Default to USDC if token is not specified
    let usdAmount = investment.amount;
    
    // Convert token amounts to USD based on token type
    if (token === 'UBC') {
      usdAmount = investment.amount * ubcPrice;
    } else if (token === 'COMPUTE') {
      usdAmount = investment.amount * computePrice;
    }
    // USDC is already in USD, no conversion needed
    
    return {
      ...investment,
      usdAmount // Add a new field for USD amount
    };
  });
}

export default function Invest() {
  const { connected, publicKey, signTransaction } = useWallet();
  const [selectedToken, setSelectedToken] = useState<'UBC' | 'COMPUTE'>('UBC');
  const [amount, setAmount] = useState<number>(100000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ubcPrice, setUbcPrice] = useState<number>(0.0001);
  const [computePrice, setComputePrice] = useState<number>(0.00001);
  
  // Token-specific minimum amounts
  const MIN_AMOUNTS = {
    UBC: 100000,
    COMPUTE: 1000000
  };
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<WalletSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPrices() {
      try {
        const fetchedUbcPrice = await getUbcPrice();
        setUbcPrice(fetchedUbcPrice);
        
        const fetchedComputePrice = await getComputePrice();
        setComputePrice(fetchedComputePrice);
        
        console.log(`Fetched prices - UBC: ${fetchedUbcPrice}, COMPUTE: ${fetchedComputePrice}`);
      } catch (error) {
        console.error("Error fetching token prices:", error);
      }
    }
    
    fetchPrices();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        
        // Fetch investments
        const investmentsResponse = await fetch('/api/investments', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (!investmentsResponse.ok) throw new Error('Failed to fetch investments');
        const investmentsData = await investmentsResponse.json();
      
        // Fetch token prices
        const ubcPrice = await getUbcPrice();
        const computePrice = await getComputePrice();
      
        console.log('Token prices:', { UBC: ubcPrice, COMPUTE: computePrice });
      
        // Convert token amounts to USD
        const investmentsWithUSD = await convertTokensToUSD(investmentsData, ubcPrice, computePrice);
      
        // Calculate total investment amount in USD
        const totalInvestmentUSD = investmentsWithUSD.reduce((sum: number, inv: Investment & { usdAmount?: number }) => 
          sum + (inv.usdAmount || 0), 0);
      
        console.log('Total investment in USD:', totalInvestmentUSD);
        
        // Fetch latest wallet snapshot from WALLET_SNAPSHOTS table
        const walletSnapshotResponse = await fetch('/api/wallet-snapshot/latest', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        let portfolioValue = 0;
        let snapshotTimestamp = new Date().toISOString();
        
        if (!walletSnapshotResponse.ok) {
          console.error('Failed to fetch wallet snapshot, falling back to portfolio API');
          // Fallback to portfolio API
          const portfolioResponse = await fetch('/api/portfolio', {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });
          if (!portfolioResponse.ok) throw new Error('Failed to fetch portfolio data');
          const portfolioData = await portfolioResponse.json();
          
          // Calculate total portfolio value from the token balances
          portfolioValue = portfolioData.reduce((sum: number, token: any) => 
            sum + (token.usdValue || 0), 0);
          
          console.log('Portfolio total value (from token balances):', portfolioValue);
        } else {
          // Use the wallet snapshot data
          const snapshotData = await walletSnapshotResponse.json();
          portfolioValue = snapshotData.totalValue || 0;
          snapshotTimestamp = snapshotData.createdAt || new Date().toISOString();
          
          console.log('Portfolio total value (from wallet snapshot):', portfolioValue);
        }
        
        // Set the latest snapshot with the calculated/adjusted total value
        setLatestSnapshot({
          totalValue: portfolioValue,
          timestamp: snapshotTimestamp
        });
        
        // Calculate returns for each investment
        const profit = Math.max(0, portfolioValue - totalInvestmentUSD); // Ensure profit is not negative
        const profitShare = profit * 0.75; // 75% of profit is distributed
      
        console.log('Total investment in USD:', totalInvestmentUSD);
        console.log('Portfolio value:', portfolioValue);
        console.log('Profit:', profit);
        console.log('Profit share (75%):', profitShare);
        
        const investmentsWithReturns = investmentsWithUSD.map((inv: Investment & { usdAmount?: number }) => {
          const investmentRatio = (inv.usdAmount || 0) / totalInvestmentUSD;
          const calculatedReturn = profitShare * investmentRatio;
          
          // Calculate UBC return (USDC return / UBC price)
          let ubcReturn = 0;
          if (ubcPrice > 0) {
            ubcReturn = calculatedReturn / ubcPrice;
            console.log(`Calculated UBC return for investment ${inv.investmentId}: ${ubcReturn} UBC (${calculatedReturn} USDC / ${ubcPrice} UBC price)`);
          } else {
            console.warn(`Cannot calculate UBC return: UBC price is ${ubcPrice}`);
          }
          
          console.log(`Investment ${inv.investmentId}: $${inv.usdAmount} (${(investmentRatio * 100).toFixed(2)}%) -> Return: $${calculatedReturn.toFixed(2)} / ${ubcReturn.toFixed(2)} UBC`);
          
          return {
            ...inv,
            return: calculatedReturn,
            ubcReturn: ubcReturn
          };
        });
        
        setInvestments(investmentsWithReturns);
        
        // Store token prices in state for later use
        setUbcPrice(ubcPrice);
        setComputePrice(computePrice);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleInvest = async () => {
    if (!connected || !publicKey || !signTransaction) {  // Add signTransaction check
      alert('Please connect your wallet first');
      return;
    }

    // Check minimum amount based on selected token
    if (amount < MIN_AMOUNTS[selectedToken]) {
      alert(`Minimum investment is ${MIN_AMOUNTS[selectedToken].toLocaleString()} ${selectedToken}`);
      return;
    }

    // Add the environment variable check here
    if (!process.env.NEXT_PUBLIC_HELIUS_RPC_URL) {
      alert('RPC URL configuration is missing');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Creating connection...');
      const connection = new Connection(
        process.env.NEXT_PUBLIC_HELIUS_RPC_URL as string, // Cast to string since we checked it above
        { commitment: 'confirmed' }
      );
        
      // Dynamically import SPL Token functions
      const { 
        getAssociatedTokenAddress, 
        createAssociatedTokenAccountInstruction,
        createTransferInstruction 
      } = await import('@solana/spl-token');

      // Determine source token mint based on selection
      let sourceMint: PublicKey;
      if (selectedToken === 'UBC') {
        sourceMint = UBC_MINT;
      } else { // COMPUTE
        sourceMint = COMPUTE_MINT;
      }

      // Get user's token account
      console.log(`Getting user ${selectedToken} token account...`);
      const userTokenAccount = await getAssociatedTokenAddress(
        sourceMint,
        publicKey
      );
      console.log('User token account:', userTokenAccount.toString());

      // Get treasury's token account
      console.log(`Getting treasury ${selectedToken} token account...`);
      const treasuryTokenAccount = await getAssociatedTokenAddress(
        sourceMint,
        TREASURY_WALLET
      );
      console.log('Treasury token account:', treasuryTokenAccount.toString());

      // Create transaction
      const transaction = new Transaction();

      // Check if user's token account exists
      console.log('Checking user account info...');
      const userAccountInfo = await connection.getAccountInfo(userTokenAccount);
      console.log('User account exists:', !!userAccountInfo);
      
      if (!userAccountInfo) {
        console.log('Creating user token account...');
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userTokenAccount,
            publicKey,
            sourceMint
          )
        );
      }

      // Check if treasury token account exists
      console.log('Checking treasury account info...');
      const treasuryAccountInfo = await connection.getAccountInfo(treasuryTokenAccount);
      console.log('Treasury account exists:', !!treasuryAccountInfo);
      
      if (!treasuryAccountInfo) {
        console.log('Creating treasury token account...');
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            treasuryTokenAccount,
            TREASURY_WALLET,
            sourceMint
          )
        );
      }

      // Check user's token balance
      try {
        console.log(`Checking ${selectedToken} balance...`);
        const balance = await connection.getTokenAccountBalance(userTokenAccount);
        
        // Get the correct decimals from the token account
        const decimals = balance.value.decimals;
        console.log(`Token decimals for ${selectedToken}: ${decimals}`);
        
        // Calculate user balance with correct decimals
        const userBalance = Number(balance.value.amount) / Math.pow(10, decimals);
        
        console.log(`User ${selectedToken} balance:`, userBalance);
          
        if (userBalance < amount) {
          alert(`Insufficient ${selectedToken} balance. You have ${userBalance.toLocaleString()} ${selectedToken}`);
          return;
        }
      } catch (error) {
        console.error('Error checking balance:', error);
        alert(`Error checking ${selectedToken} balance. Please try again.`);
        return;
      }

      // Add transfer instruction with appropriate decimals from the token account
      try {
        // Get token account info to determine decimals
        const tokenAccountInfo = await connection.getTokenAccountBalance(userTokenAccount);
        const decimals = tokenAccountInfo.value.decimals;
        console.log(`Using ${decimals} decimals for ${selectedToken}`);
        
        transaction.add(
          createTransferInstruction(
            userTokenAccount,
            treasuryTokenAccount,
            publicKey,
            BigInt(Math.floor(amount * Math.pow(10, decimals))) // Use BigInt for large numbers
          )
        );
      } catch (error) {
        console.error('Error creating transfer instruction:', error);
        throw new Error(`Failed to create transfer: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error('Transaction failed to confirm');
      }

      // Create investment record in Airtable
      try {
        const response = await fetch('/api/investments/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: selectedToken,
            amount: amount,
            wallet: publicKey.toString(),
            solscanUrl: `https://solscan.io/tx/${signature}`
          })
        });

        if (!response.ok) {
          console.error('Failed to create investment record:', await response.text());
        } else {
          console.log('Investment record created successfully');
          
          // Send Telegram notification
          try {
            await sendTelegramNotification({
              token: selectedToken,
              amount: amount,
              wallet: publicKey.toString(),
              solscanUrl: `https://solscan.io/tx/${signature}`
            });
          } catch (notifyError) {
            console.error('Failed to send notification, but investment was successful:', notifyError);
          }
        }
      } catch (error) {
        console.error('Error creating investment record:', error);
      }

      alert('Investment successful! Transaction signature: ' + signature);
    } catch (error) {
      console.error('Investment failed:', error);
      if (error instanceof Error) {
        alert(`Investment failed: ${error.message}`);
      } else {
        alert('Investment failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate total investment amount
  const totalInvestment = investments.reduce((sum, inv) => sum + inv.amount, 0);
  
  return (
    <main className="min-h-screen p-4 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-center">Invest in KinKong</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* First row - takes up full width (or 70% on larger screens) */}
        <div className="md:col-span-2">
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Your Investments</h2>
            <YourInvestments />
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Latest Redistributions</h2>
            <RedistributionsTable />
          </section>
        </div>
        
        {/* Second row - takes up 30% width and is fixed */}
        <div className="md:col-span-1">
          <div className="sticky top-24">
            <section>
              <h2 className="text-2xl font-bold mb-4">Invest Now</h2>
              <div className="investment-form bg-black/30 p-6 rounded-lg border border-gold/20">
                <div className="space-y-5">
                {/* Token Selection */}
                <div>
                  <label className="block text-sm mb-2 text-gray-300">
                    Select Token
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setSelectedToken('UBC')}
                      className={`py-2 px-4 rounded-lg border ${
                        selectedToken === 'UBC' 
                          ? 'bg-gold/20 border-gold text-white' 
                          : 'bg-black/20 border-gray-700 text-gray-400'
                      }`}
                    >
                      <span className="metallic-text-ubc">$UBC</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedToken('COMPUTE')}
                      className={`py-2 px-4 rounded-lg border ${
                        selectedToken === 'COMPUTE' 
                          ? 'bg-gold/20 border-gold text-white' 
                          : 'bg-black/20 border-gray-700 text-gray-400'
                      }`}
                    >
                      <span className="metallic-text-compute">$COMPUTE</span>
                    </button>
                  </div>
                </div>
              
                <div>
                  <label htmlFor="amount" className="block text-sm mb-2 text-gray-300">
                    Investment Amount
                  </label>
                  <div className="relative">
                    <input 
                      id="amount"
                      type="number" 
                      placeholder={`Amount in ${selectedToken}`}
                      className="input-field pr-16 py-3"
                      min="1"
                      step="1"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      ${selectedToken}
                    </span>
                  </div>
                </div>
                <button 
                  className="btn-primary w-full py-3 mt-2"
                  onClick={handleInvest}
                  disabled={!connected || isSubmitting || amount < MIN_AMOUNTS[selectedToken]}
                >
                  {isSubmitting ? 'Processing...' : 'Invest Now'}
                </button>
                <p className="text-sm text-gray-400 text-center">
                  Minimum investment: {MIN_AMOUNTS[selectedToken].toLocaleString()}{' '}
                  <TokenDisplay token={selectedToken} options={{ className: 'text-gray-400' }} />
                </p>
                
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <h3 className="text-sm font-medium text-gold mb-2">Investment Conditions</h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>75% of profits redistributed weekly</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Funds withdrawable at any time</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>2% fee on in-out transactions</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Profits redistributed in $UBC</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Terms may vary if required</span>
                    </li>
                  </ul>
                </div>
                </div>
              </div>
            </section>
            
            {/* Add disclaimer card below the investment card */}
            <div className="mt-4">
              <div className="bg-black/20 p-4 rounded-lg border border-gray-800">
                <h3 className="text-xs font-medium text-gray-400 mb-2">Important Risk Disclosure</h3>
                <div className="text-xs text-gray-500 space-y-2">
                  <p>
                    Investing in cryptocurrency assets involves significant risk and may result in partial or total loss of your investment. Past performance is not indicative of future results.
                  </p>
                  <p>
                    No returns or profits are guaranteed. The value of your investment can fluctuate significantly due to market volatility, liquidity risks, regulatory changes, and other factors beyond our control.
                  </p>
                  <p>
                    The redistribution mechanism described is subject to change and depends on the performance of the underlying portfolio. Withdrawals may be subject to network conditions and liquidity constraints.
                  </p>
                  <p>
                    This is not financial advice. Please conduct your own research and consider consulting with a financial professional before investing. Only invest what you can afford to lose.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
