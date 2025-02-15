import { WalletConnect } from '@/components/wallet/WalletConnect'

export default function Invest() {
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-8">Invest in KinKong</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Connect Wallet</h2>
        <WalletConnect />
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Investment Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="info-card">
            <h3>Total Raise</h3>
            <p>7,000,000 USDC</p>
          </div>
          <div className="info-card">
            <h3>Focus</h3>
            <p>AI token trading on Solana</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Invest Now</h2>
        <div className="investment-form">
          <input 
            type="number" 
            placeholder="Amount in USDC"
            className="input-field"
          />
          <button className="btn-primary">
            Invest
          </button>
        </div>
      </section>
    </main>
  )
}
