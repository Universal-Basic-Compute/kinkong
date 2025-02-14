export default function Strategy() {
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-8">KinKong Strategy</h1>
      
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Core Approach</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="strategy-card">
            <h3>Trading Frequency</h3>
            <p>4x daily trading cycles optimized for Solana ecosystem</p>
          </div>
          <div className="strategy-card">
            <h3>Portfolio Structure</h3>
            <p>Dynamic portfolio of 10 AI tokens + SOL + Stables</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Market Adaptation</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="strategy-card">
            <h3>Bull Market</h3>
            <ul>
              <li>70% AI Tokens</li>
              <li>20% SOL</li>
              <li>10% Stables</li>
            </ul>
          </div>
          <div className="strategy-card">
            <h3>Bear Market</h3>
            <ul>
              <li>40% AI Tokens</li>
              <li>20% SOL</li>
              <li>40% Stables</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
