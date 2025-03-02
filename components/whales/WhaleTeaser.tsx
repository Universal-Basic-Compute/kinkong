import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

export function WhaleTeaser() {
  return (
    <div className="min-h-[60vh] max-w-4xl mx-auto">
      <div className="bg-black/30 p-8 rounded-lg border border-gold/20">
        <h2 className="text-3xl font-bold mb-6">Whale Analysis</h2>
        
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4 text-gold">Follow the Smart Money</h3>
          <p className="text-gray-300 mb-4">
            Whale analysis is a powerful tool for understanding market movements before they happen. 
            By tracking the behavior of the largest token holders, you can gain insights that most 
            traders miss.
          </p>
          <p className="text-gray-300 mb-4">
            Our AI-powered whale analysis system monitors the top 20 holders for UBC and COMPUTE tokens, 
            analyzing their transaction patterns and providing actionable intelligence.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-black/40 p-6 rounded-lg border border-gold/10">
            <h4 className="font-bold mb-2 text-gold">Holding Patterns</h4>
            <p className="text-gray-400 text-sm">
              Identify accumulation and distribution patterns from major players before price movements occur.
            </p>
          </div>
          
          <div className="bg-black/40 p-6 rounded-lg border border-gold/10">
            <h4 className="font-bold mb-2 text-gold">Sentiment Analysis</h4>
            <p className="text-gray-400 text-sm">
              Gauge market sentiment based on whale behavior with bullish/bearish indicators and confidence scores.
            </p>
          </div>
          
          <div className="bg-black/40 p-6 rounded-lg border border-gold/10">
            <h4 className="font-bold mb-2 text-gold">AI Meta-Analysis</h4>
            <p className="text-gray-400 text-sm">
              Get comprehensive AI-generated insights that aggregate all whale data into actionable trading strategies.
            </p>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-gold/20 to-black/0 p-6 rounded-lg mb-8">
          <h3 className="text-xl font-bold mb-2">Pro Membership Required</h3>
          <p className="text-gray-300 mb-4">
            Whale analysis is available exclusively to Kong Pro members. Upgrade now to access this powerful feature.
          </p>
          <Link 
            href="/copilot" 
            className="inline-flex items-center px-6 py-3 bg-gold/20 hover:bg-gold/30 border border-gold rounded-lg text-white font-medium transition-colors duration-200"
          >
            Upgrade to Pro <ArrowRightIcon className="ml-2 h-4 w-4" />
          </Link>
        </div>
        
        <div className="text-sm text-gray-500">
          <p>
            Our whale analysis is updated daily and provides insights that can help you make more informed trading decisions.
            Pro members also get access to additional features like advanced signals, portfolio recommendations, and more.
          </p>
        </div>
      </div>
    </div>
  );
}
