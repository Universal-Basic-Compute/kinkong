'use client';
import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Mainnet USDC
const UBC_MINT = new PublicKey('9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump'); // UBC token
const TREASURY_WALLET = new PublicKey('FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY');

interface TokenPrice {
  price: number;
  timestamp: number;
}

interface Investment {
  investmentId: string;
  amount: number;
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

const validateInvestment = (inv: any): inv is Investment => {
  return (
    typeof inv.investmentId === 'string' &&
    typeof inv.amount === 'number' &&
    typeof inv.solscanUrl === 'string' &&
    typeof inv.date === 'string' &&
    typeof inv.wallet === 'string'
  );
};

export default function Invest() {
  const { connected, publicKey, signTransaction } = useWallet();
  const [amount, setAmount] = useState<number>(500);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<WalletSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        
        // Fetch investments
        const investmentsResponse = await fetch('/api/investments');
        if (!investmentsResponse.ok) throw new Error('Failed to fetch investments');
        const investmentsData = await investmentsResponse.json();
        
        // Calculate total investment amount
        const totalInvestment = investmentsData.reduce((sum: number, inv: Investment) => sum + inv.amount, 0);
        console.log('Total investment from API:', totalInvestment);
        
        // Fetch latest wallet snapshot from PORTFOLIO_SNAPSHOT table
        const snapshotResponse = await fetch('/api/portfolio-snapshot/latest');
        
        let portfolioValue = 0;
        let snapshotTimestamp = new Date().toISOString();
        
        if (!snapshotResponse.ok) {
          console.error('Failed to fetch portfolio snapshot, falling back to portfolio API');
          // Fallback to portfolio API
          const portfolioResponse = await fetch('/api/portfolio');
          if (!portfolioResponse.ok) throw new Error('Failed to fetch portfolio data');
          const portfolioData = await portfolioResponse.json();
          
          // Calculate total portfolio value from the token balances
          portfolioValue = portfolioData.reduce((sum: number, token: any) => 
            sum + (token.usdValue || 0), 0);
          
          console.log('Portfolio total value (from token balances):', portfolioValue);
        } else {
          // Use the portfolio snapshot data
          const snapshotData = await snapshotResponse.json();
          portfolioValue = snapshotData.totalValue || 0;
          snapshotTimestamp = snapshotData.createdAt || new Date().toISOString();
          
          console.log('Portfolio total value (from snapshot):', portfolioValue);
        }
        
        // Set the latest snapshot with the calculated/adjusted total value
        setLatestSnapshot({
          totalValue: portfolioValue,
          timestamp: snapshotTimestamp
        });
        
        // Calculate returns for each investment
        const profit = Math.max(0, portfolioValue - totalInvestment); // Ensure profit is not negative
        const profitShare = profit * 0.75; // 75% of profit is distributed
        
        console.log('Total investment:', totalInvestment);
        console.log('Portfolio value:', portfolioValue);
        console.log('Profit:', profit);
        console.log('Profit share (75%):', profitShare);
        
        // Fetch UBC price directly from DexScreener
        const ubcPrice = await getUbcPrice();
        console.log('UBC price:', ubcPrice);
        
        const investmentsWithReturns = investmentsData.map((inv: Investment) => {
          const investmentRatio = inv.amount / totalInvestment;
          const calculatedReturn = profitShare * investmentRatio;
          
          // Calculate UBC return (USDC return / UBC price)
          let ubcReturn = 0;
          if (ubcPrice > 0) {
            ubcReturn = calculatedReturn / ubcPrice;
            console.log(`Calculated UBC return for investment ${inv.investmentId}: ${ubcReturn} UBC (${calculatedReturn} USDC / ${ubcPrice} UBC price)`);
          } else {
            console.warn(`Cannot calculate UBC return: UBC price is ${ubcPrice}`);
          }
          
          console.log(`Investment ${inv.investmentId}: $${inv.amount} (${(investmentRatio * 100).toFixed(2)}%) -> Return: $${calculatedReturn.toFixed(2)} / ${ubcReturn.toFixed(2)} UBC`);
          
          return {
            ...inv,
            return: calculatedReturn,
            ubcReturn: ubcReturn
          };
        });
        
        setInvestments(investmentsWithReturns);
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

    if (amount < 500) {
      alert('Minimum investment is 500 USDC');
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

      // Get user's USDC token account
      console.log('Getting user token account...');
      const userTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        publicKey
      );
      console.log('User token account:', userTokenAccount.toString());

      // Get treasury's USDC token account
      console.log('Getting treasury token account...');
      const treasuryTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
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
            USDC_MINT
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
            USDC_MINT
          )
        );
      }

      // Check user's USDC balance
      try {
        console.log('Checking USDC balance...');
        const balance = await connection.getTokenAccountBalance(userTokenAccount);
        const userBalance = Number(balance.value.amount) / 1_000_000; // Convert from decimals
        console.log('User USDC balance:', userBalance);
          
        if (userBalance < amount) {
          alert(`Insufficient USDC balance. You have ${userBalance} USDC`);
          return;
        }
      } catch (error) {
        console.error('Error checking balance:', error);
        alert('Error checking USDC balance. Please try again.');
        return;
      }

      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          userTokenAccount,
          treasuryTokenAccount,
          publicKey,
          amount * 1_000_000 // Convert to USDC decimals (6)
        )
      );
      
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
                        {typeof investment.amount === 'number' 
                          ? (
                            <>
                              <span className="text-white font-medium">{investment.amount.toLocaleString('en-US')}</span>{' '}
                              <span className="text-gray-400">$USDC</span>
                            </>
                          )
                          : 'N/A'}
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
                  <span className="text-white ml-2 font-medium">{Math.floor(totalInvestment).toLocaleString('en-US')}</span> 
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
                <div>
                  <label htmlFor="amount" className="block text-sm mb-2 text-gray-300">
                    Investment Amount
                  </label>
                  <div className="relative">
                    <input 
                      id="amount"
                      type="number" 
                      placeholder="Amount in $USDC"
                      className="input-field pr-16 py-3"
                      min="1"
                      step="0.1"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      $USDC
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
                        const usdcReturn = Math.max(0, ((latestSnapshot.totalValue - totalInvestment) * 0.75 * (amount / (totalInvestment + amount))));
                        const ubcReturn = investments.length > 0 && investments[0].ubcReturn !== undefined && investments[0].return !== undefined
                          ? usdcReturn * (investments[0].ubcReturn / investments[0].return)
                          : 0;
                        return (
                          <>
                            <span className="metallic-text-ubc">{ubcReturn.toLocaleString('en-US', { maximumFractionDigits: 2 })} $UBC</span> 
                            <span className="text-gray-400 text-sm ml-1">($${usdcReturn.toLocaleString('en-US', { maximumFractionDigits: 2 })})</span>
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
                  disabled={!connected || isSubmitting || amount < 1}
                >
                  {isSubmitting ? 'Processing...' : 'Invest Now'}
                </button>
                <p className="text-sm text-gray-400 text-center">
                  Minimum investment: 500 <span className="text-gray-400">$USDC</span>
                </p>
              </div>
            </div>
          </section>
      </div>
    </main>
  )
}
