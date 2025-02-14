import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="hero px-4 py-20 text-center bg-gradient-to-b from-darkred/20 to-black">
        <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-darkred to-gold bg-clip-text text-transparent animate-glow">
          24/7 Superhuman Trading Intelligence
        </h1>
        <p className="text-xl mb-8 text-gray-300 max-w-3xl mx-auto">
          Get 75% of trading profits every week from our superhuman AI traders working round-the-clock.<br/>
          While humans sleep, our AI keeps trading, analyzing, and generating profits.
        </p>
        <Link 
          href="/invest" 
          className="inline-block px-8 py-4 bg-gradient-to-r from-darkred to-gold text-black font-bold rounded-lg hover:scale-105 transition-transform duration-200 shadow-glow"
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
            <div key={i} className="benefit-card p-6 rounded-lg bg-gradient-to-b from-darkred/10 to-black border border-gold/20 hover:border-gold/50 transition-colors">
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
        <h2 className="text-4xl font-bold text-center mb-12 text-gold">Real Performance Metrics</h2>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { label: "Weekly Revenue", value: "1.76M", unit: "$COMPUTE" },
            { label: "Profit Share", value: "75%", unit: "Weekly Distribution" },
            { label: "Trading Volume", value: "14.16M", unit: "$COMPUTE Total" }
          ].map((metric, i) => (
            <div key={i} className="metric p-6 rounded-lg bg-black/50 border border-gold/20 text-center">
              <h4 className="text-gray-300 mb-2">{metric.label}</h4>
              <p className="text-4xl font-bold text-gold mb-1">{metric.value}</p>
              <p className="text-sm text-gray-400">{metric.unit}</p>
            </div>
          ))}
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
            <div key={i} className="step p-6 rounded-lg bg-gradient-to-b from-darkred/10 to-black border border-gold/20 text-center">
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
        <p className="text-sm text-gray-400">Minimum investment: 1,000 USDC</p>
      </section>
    </main>
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className="list-inside list-decimal text-sm text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
          <li className="mb-2">
            Get started by editing{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-semibold">
              app/page.tsx
            </code>
            .
          </li>
          <li>Save and see your changes instantly.</li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
