import { WalletConnect } from '@/components/wallet/WalletConnect'

export default function Invest() {
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
                <button className="btn-primary w-full py-3">
                  Invest Now
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
