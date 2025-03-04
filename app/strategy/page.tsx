import { StrategyThoughts } from '@/components/strategy/StrategyThoughts';
import { MarketSentimentDisplay } from '@/components/strategy/MarketSentimentDisplay';

export default function Strategy() {
  return (
    <main className="min-h-screen p-4 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">KinKong Strategy</h1>
      
      <div className="grid grid-cols-1 gap-8">
        {/* Market Sentiment Display */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Current Market Sentiment</h2>
          <MarketSentimentDisplay />
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">KinKong's Thoughts</h2>
          <StrategyThoughts />
        </section>
      </div>
    </main>
  );
}
