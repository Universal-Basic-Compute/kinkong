export default function DisclaimerPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gold mb-8">Risk Disclaimer</h1>
      
      <div className="prose prose-invert prose-gold max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">1. Cryptocurrency Trading Risks</h2>
          <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-200 font-semibold">
              Trading cryptocurrencies involves substantial risk of loss and is not suitable for all investors. You should carefully consider whether trading is suitable for you in light of your circumstances, knowledge, and financial resources.
            </p>
          </div>
          <ul className="list-disc pl-6 mt-4">
            <li>Cryptocurrencies are highly volatile and speculative investments</li>
            <li>You may lose your entire investment</li>
            <li>Past performance is not indicative of future results</li>
            <li>The cryptocurrency market operates 24/7 and can experience rapid price changes at any time</li>
            <li>Market manipulation and fraudulent activities may occur</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">2. Automated Trading Risks</h2>
          <p>
            KinKong uses automated trading strategies which carry specific risks:
          </p>
          <ul className="list-disc pl-6 mt-4">
            <li>Technical failures or bugs may lead to unexpected trading behavior</li>
            <li>Network congestion may affect trade execution</li>
            <li>Smart contract vulnerabilities could result in loss of funds</li>
            <li>Market conditions may change faster than the system can react</li>
            <li>Automated strategies may not perform as expected in extreme market conditions</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">3. Solana Network Risks</h2>
          <p>
            Operating on the Solana blockchain involves specific risks:
          </p>
          <ul className="list-disc pl-6 mt-4">
            <li>Network congestion or outages may prevent trade execution</li>
            <li>Smart contract bugs or exploits could affect protocol security</li>
            <li>Changes to the Solana network may impact our service</li>
            <li>Wallet security breaches could result in loss of funds</li>
            <li>DEX liquidity issues may affect trade execution and pricing</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">4. Market Liquidity Risks</h2>
          <p>
            Trading AI tokens on Solana involves liquidity considerations:
          </p>
          <ul className="list-disc pl-6 mt-4">
            <li>Some tokens may have limited trading volume</li>
            <li>Large trades may significantly impact token prices</li>
            <li>Liquidity can disappear quickly in stress scenarios</li>
            <li>Price slippage may be higher than expected</li>
            <li>Exit positions may be difficult during market stress</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">5. Technical and Operational Risks</h2>
          <p>
            Using our platform involves technical risks:
          </p>
          <ul className="list-disc pl-6 mt-4">
            <li>Software bugs or errors may affect trading performance</li>
            <li>API failures could prevent trade execution</li>
            <li>Data feed issues may lead to incorrect trading decisions</li>
            <li>System upgrades may cause temporary service interruptions</li>
            <li>Cybersecurity threats could compromise the platform</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">6. No Investment Advice</h2>
          <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-yellow-200">
              KinKong does not provide investment advice. All trading signals and portfolio allocations are generated automatically based on technical analysis and market data. You are solely responsible for your investment decisions.
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">7. Acknowledgment of Risks</h2>
          <p>
            By using KinKong, you acknowledge and agree that:
          </p>
          <ul className="list-disc pl-6 mt-4">
            <li>You understand all risks associated with cryptocurrency trading</li>
            <li>You are responsible for your own trading decisions</li>
            <li>You will not hold KinKong liable for any trading losses</li>
            <li>You have sufficient knowledge and experience to evaluate the risks</li>
            <li>You will only trade with funds you can afford to lose</li>
          </ul>
        </section>

        <div className="mt-12 text-sm text-gray-400">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
