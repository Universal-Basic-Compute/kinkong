'use client';
import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  Connection,
  PublicKey, 
  Transaction 
} from '@solana/web3.js';

import { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  createTransferInstruction 
} from '@solana/spl-token';

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Mainnet USDC
const TREASURY_WALLET = new PublicKey('FnWyN4t1aoZWFjEEBxopMaAgk5hjL5P3K65oc2T9FBJY');

interface Investment {
  investmentId: string;
  amount: number;
  solscanUrl: string;
  date: string;
  username: string;
  wallet: string;
}

const validateInvestment = (inv: any): inv is Investment => {
  return (
    typeof inv.investmentId === 'string' &&
    typeof inv.amount === 'number' &&
    typeof inv.solscanUrl === 'string' &&
    typeof inv.date === 'string' &&
    typeof inv.username === 'string' &&
    typeof inv.wallet === 'string'
  );
};

export default function Invest() {
  const { connected, publicKey, signTransaction } = useWallet();
  const [amount, setAmount] = useState<number>(500);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchInvestments() {
      try {
        const response = await fetch('/api/investments');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setInvestments(data);
      } catch (error) {
        console.error('Error fetching investments:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchInvestments();
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
                    <th className="px-4 py-2 text-left">Username</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {investments.filter(validateInvestment).map((investment) => (
                    <tr key={investment.investmentId} className="border-b border-gold/10 hover:bg-gold/5">
                      <td className="px-4 py-2">{investment.username}</td>
                      <td className="px-4 py-2 text-right">
                        {typeof investment.amount === 'number' 
                          ? `${investment.amount.toLocaleString('en-US')} USDC`
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-2">
                        {investment.date 
                          ? new Date(investment.date).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-2">
                        <a 
                          href={investment.solscanUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold hover:text-gold/80 underline"
                        >
                          View on Solscan
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">Investment Details</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="info-card">
                <h3 className="text-lg mb-2">Focus</h3>
                <p className="text-xl">AI token trading on Solana</p>
              </div>
              <div className="info-card">
                <h3 className="text-lg mb-2">Minimum Investment</h3>
                <p className="text-xl">500 USDC</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Key Benefits</h2>
            <div className="info-card">
              <ul className="space-y-3">
                <li className="flex items-center">
                  <span className="text-gold mr-2">•</span>
                  75% Weekly profit distribution
                </li>
                <li className="flex items-center">
                  <span className="text-gold mr-2">•</span>
                  24/7 AI-powered trading
                </li>
                <li className="flex items-center">
                  <span className="text-gold mr-2">•</span>
                  Automatic USDC payments
                </li>
                <li className="flex items-center">
                  <span className="text-gold mr-2">•</span>
                  Full transparency on all trades
                </li>
              </ul>
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">Connect Wallet</h2>
            <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
              <WalletConnect />
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Invest Now</h2>
            <div className="investment-form bg-black/30 p-6 rounded-lg border border-gold/20">
              <div className="space-y-4">
                <div>
                  <label htmlFor="amount" className="block text-sm mb-2">
                    Investment Amount
                  </label>
                  <input 
                    id="amount"
                    type="number" 
                    placeholder="Amount in USDC"
                    className="input-field"
                    min="1"
                    step="0.1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">
                    Estimated Weekly Returns
                  </label>
                  <div className="text-gold text-xl font-bold">
                    Calculate based on amount
                  </div>
                </div>
                <button 
                  className="btn-primary w-full py-3"
                  onClick={handleInvest}
                  disabled={!connected || isSubmitting || amount < 1}
                >
                  {isSubmitting ? 'Processing...' : 'Invest Now'}
                </button>
                <p className="text-sm text-gray-400 text-center">
                  Minimum investment: 500 USDC
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
