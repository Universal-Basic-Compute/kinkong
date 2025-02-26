'use client';
import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

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

const validateInvestment = (inv: any): inv is Investment => {
  return (
    typeof inv.investmentId === 'string' &&
    typeof inv.amount === 'number' &&
    typeof inv.solscanUrl === 'string' &&
    typeof inv.date === 'string' &&
    typeof inv.wallet === 'string'
  );
};

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
        const investmentsResponse = await fetch('/api/investments');
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
        const walletSnapshotResponse = await fetch('/api/wallet-snapshot/latest');
        
        let portfolioValue = 0;
        let snapshotTimestamp = new Date().toISOString();
        
        if (!walletSnapshotResponse.ok) {
          console.error('Failed to fetch wallet snapshot, falling back to portfolio API');
          // Fallback to portfolio API
          const portfolioResponse = await fetch('/api/portfolio');
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

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Current Investors</h2>
        {isLoading ? (
          <div className="text-center">Loading investors...</div>
        ) : (
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gold/20">
                    <th className="px-4 py-3 text-left font-bold">Username</th>
                    <th className="px-4 py-3 text-right font-bold">Initial Investment</th>
                    <th className="px-4 py-3 text-right font-bold">Return</th>
                    <th className="px-4 py-3 text-left font-bold">Date</th>
                    <th className="px-4 py-3 text-left font-bold">Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {investments.filter(validateInvestment).map((investment) => (
                    <tr key={investment.investmentId} className="border-b border-gold/10 hover:bg-gold/5">
                      <td className="px-4 py-4 text-white">{investment.username || 'Anonymous'}</td>
                      <td className="px-4 py-4 text-right">
                        {typeof investment.amount === 'number' ? (
                          <>
                            <div>
                              <span className="text-white font-medium">{Math.floor(investment.amount).toLocaleString('en-US')}</span>{' '}
                              <span className={`text-gray-400 ${investment.token === 'UBC' ? 'metallic-text-ubc' : investment.token === 'COMPUTE' ? 'metallic-text-compute' : ''}`}>
                                ${investment.token || 'USDC'}
                              </span>
                            </div>
                            {investment.usdAmount && (
                              <div className="text-gray-400 text-sm">
                                (${Math.floor(investment.usdAmount).toLocaleString('en-US')})
                              </div>
                            )}
                          </>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {investment.ubcReturn !== undefined ? (
                          <>
                            <span className="metallic-text-ubc font-medium">
                              {Math.floor(investment.ubcReturn).toLocaleString('en-US')} $UBC
                            </span> 
                            <span className="text-gray-400 text-sm ml-1">
                              (${investment.return ? Math.floor(investment.return).toLocaleString('en-US') : '0'})
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-400">Calculating...</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {investment.date 
                          ? new Date(investment.date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            }).replace(/\//g, '/')
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-4">
                        <a 
                          href={investment.solscanUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold hover:text-gold/80 font-medium"
                        >
                          View on Solscan
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {latestSnapshot && (
              <div className="mt-6 text-sm space-y-1">
                <p>
                  <span className="text-gray-400">Portfolio Value:</span> 
                  <span className="text-white ml-2 font-medium">{Math.floor(latestSnapshot.totalValue).toLocaleString('en-US')}</span> 
                  <span className="text-gray-400">$USDC</span>
                </p>
                <p>
                  <span className="text-gray-400">Total Investment:</span> 
                  <span className="text-white ml-2 font-medium">
                    {Math.floor(investments.reduce((sum, inv) => sum + (inv.usdAmount || 0), 0)).toLocaleString('en-US')}
                  </span> 
                  <span className="text-gray-400">$USDC</span>
                </p>
                <p className="text-gray-400">
                  Last Updated: {new Date(latestSnapshot.timestamp).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  }).replace(/\//g, '/')}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">Connect Wallet</h2>
            <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
              <WalletConnect />
            </div>
          </section>

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
                      step={selectedToken === 'USDC' ? '0.1' : '1'}
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      ${selectedToken}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-2 text-gray-300">
                    Estimated Weekly Returns
                  </label>
                  <div className="text-xl font-bold p-3 bg-black/20 rounded-lg border border-gold/10">
                    {latestSnapshot && totalInvestment > 0 ? (
                      (() => {
                        // Convert investment amount to USDC equivalent for calculation
                        let usdcEquivalent = 0;
                        if (selectedToken === 'UBC') {
                          // Use the state variable for UBC price
                          usdcEquivalent = amount * ubcPrice;
                        } else if (selectedToken === 'COMPUTE') {
                          // Use the state variable for COMPUTE price
                          usdcEquivalent = amount * computePrice;
                          console.log(`Using COMPUTE price for calculation: ${computePrice}`);
                        }
                        
                        const usdcReturn = Math.max(0, ((latestSnapshot.totalValue - totalInvestment) * 0.75 * (usdcEquivalent / (totalInvestment + usdcEquivalent))));
                        const ubcReturn = investments.length > 0 && investments[0].ubcReturn !== undefined && investments[0].return !== undefined
                          ? usdcReturn * (investments[0].ubcReturn / investments[0].return)
                          : 0;
                        return (
                          <>
                            <span className="metallic-text-ubc">{Math.floor(ubcReturn).toLocaleString()} $UBC</span> 
                            <span className="text-gray-400 text-sm ml-1">(${Math.floor(usdcReturn).toLocaleString()})</span>
                          </>
                        );
                      })()
                    ) : (
                      'Calculate based on amount'
                    )}
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
                  Minimum investment: {MIN_AMOUNTS[selectedToken].toLocaleString()} <span className="text-gray-400">${selectedToken}</span>
                </p>
              </div>
            </div>
          </section>
      </div>
    </main>
  )
}
