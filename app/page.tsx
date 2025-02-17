import Link from 'next/link';
import Image from 'next/image';
import { MetricsDisplay } from '@/components/home/MetricsDisplay';

export default function Home() {
  console.log('🏠 Home page rendered');
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="hero px-4 py-20 text-center bg-gradient-to-b from-black via-darkred/10 to-black">
        <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-darkred to-gold bg-clip-text text-transparent">
          24/7 Superhuman Trading Intelligence
        </h1>
        <p className="text-xl mb-8 text-gray-300 max-w-3xl mx-auto">
          Get 75% of trading profits every week from our superhuman AI traders working round-the-clock.<br/>
          While humans sleep, our AI keeps trading, analyzing, and generating profits.
        </p>
        <Link 
          href="/invest" 
          className="inline-block px-8 py-4 bg-gradient-to-r from-darkred/90 to-gold/90 text-black font-bold rounded-lg hover-effect transition-all"
        >
          Start Earning With Our AI Traders
        </Link>
      </section>

      <section className="benefits py-20 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: "🤖",
              title: "Superhuman Capabilities",
              items: [
                "Processes millions of data points per second",
                "Never misses a trading opportunity",
                "Zero emotional bias"
              ]
            },
            {
              icon: "💰",
              title: "Weekly Profit Share",
              items: [
                "75% of profits distributed to investors",
                "Automatic USDC payments every Friday",
                "Full transparency on all trades"
              ]
            },
            {
              icon: "⚡",
              title: "24/7 Market Coverage",
              items: [
                "Trading while you sleep",
                "Instant reaction to market moves",
                "Multi-market monitoring"
              ]
            }
          ].map((benefit, i) => (
            <div key={i} className="benefit-card p-6 rounded-lg metallic-surface border border-gold/10 hover:border-gold/20 transition-all">
              <div className="text-4xl mb-4">{benefit.icon}</div>
              <h3 className="text-xl font-bold mb-4 text-gold">{benefit.title}</h3>
              <ul className="space-y-2">
                {benefit.items.map((item, j) => (
                  <li key={j} className="text-gray-300">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="metrics py-20 px-4 bg-gradient-to-b from-black to-darkred/20">
        <h2 className="text-4xl font-bold text-center mb-12 text-gold electric-text">Real Performance Metrics</h2>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Render three instances of MetricsDisplay to fill the grid */}
          <MetricsDisplay />
          <MetricsDisplay />
          <MetricsDisplay />
        </div>
      </section>

      <section className="how-it-works py-20 px-4">
        <h2 className="text-4xl font-bold text-center mb-12 text-gold">How It Works</h2>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { number: 1, title: "Invest", desc: "Start with minimum 1,000 USDC" },
            { number: 2, title: "AI Trades", desc: "Our AI trades 24/7 across markets" },
            { number: 3, title: "Get Paid", desc: "Receive 75% profits every Friday" }
          ].map((step, i) => (
            <div key={i} className="step p-6 rounded-lg metallic-surface border border-gold/10 text-center transition-all hover-effect">
              <div className="w-12 h-12 rounded-full bg-gold text-black font-bold text-xl flex items-center justify-center mx-auto mb-4">
                {step.number}
              </div>
              <h3 className="text-xl font-bold mb-2 text-gold">{step.title}</h3>
              <p className="text-gray-300">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta py-20 px-4 text-center bg-gradient-to-b from-darkred/20 to-black">
        <h2 className="text-4xl font-bold mb-4 text-gold">Start Trading With Superhuman Intelligence</h2>
        <p className="text-xl mb-8 text-gray-300">Join thousands of investors earning weekly profits</p>
        <Link 
          href="/invest" 
          className="inline-block px-8 py-4 bg-gradient-to-r from-darkred to-gold text-black font-bold rounded-lg hover:scale-105 transition-transform duration-200 shadow-glow mb-4"
        >
          Start Earning Now
        </Link>
        <p className="text-sm text-gray-400">Minimum investment: 500 USDC</p>
      </section>
    </main>
  );
}
