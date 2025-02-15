'use client';
import { useState } from 'react';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  Connection, 
  clusterApiUrl, 
  PublicKey, 
  Transaction 
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createTransferInstruction 
} from '@solana/spl-token';

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Mainnet USDC
const TREASURY_WALLET = new PublicKey('YOUR_TREASURY_WALLET_ADDRESS'); // Replace with your treasury wallet

export default function Invest() {
  const { connected, publicKey, signTransaction } = useWallet();
  const [amount, setAmount] = useState<number>(1000);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInvest = async () => {
    if (!connected || !publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (amount < 1000) {
      alert('Minimum investment is 1,000 USDC');
      return;
    }

    setIsSubmitting(true);
    try {
      const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
      
      // Get user's USDC token account
      const userTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        publicKey
      );

      // Get treasury's USDC token account
      const treasuryTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        TREASURY_WALLET
      );

      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        userTokenAccount,
        treasuryTokenAccount,
        publicKey,
        amount * 1_000_000 // Convert to USDC decimals (6)
      );

      // Create transaction
      const transaction = new Transaction().add(transferInstruction);
      
      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      alert('Investment successful! Transaction signature: ' + signature);
    } catch (error) {
      console.error('Investment failed:', error);
      alert('Investment failed. Please check your USDC balance and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <main className="min-h-screen p-4 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-center">Invest in KinKong</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">Investment Details</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="info-card">
                <h3 className="text-lg mb-2">Total Raise</h3>
                <p className="text-3xl text-gold">7,000,000 USDC</p>
              </div>
              <div className="info-card">
                <h3 className="text-lg mb-2">Focus</h3>
                <p className="text-xl">AI token trading on Solana</p>
              </div>
              <div className="info-card">
                <h3 className="text-lg mb-2">Minimum Investment</h3>
                <p className="text-xl">1,000 USDC</p>
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
                    min="1000"
                    step="100"
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
                  disabled={!connected || isSubmitting || amount < 1000}
                >
                  {isSubmitting ? 'Processing...' : 'Invest Now'}
                </button>
                <p className="text-sm text-gray-400 text-center">
                  Minimum investment: 1,000 USDC
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
