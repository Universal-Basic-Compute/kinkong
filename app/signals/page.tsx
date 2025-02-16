import { SignalForm } from '@/components/signals/SignalForm'
import { SignalHistory } from '@/components/signals/SignalHistory'

export default function Signals() {
  return (
    <main className="min-h-screen p-4 max-w-7xl mx-auto">
      <div className="space-y-6">
        {/* Header Section */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Community Signals</h1>
          <p className="text-sm text-gray-400">
            Share valuable trading insights with the community and earn additional profit share allocations based on signal performance.
          </p>
        </div>

        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/30 border border-gold/20 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gold mb-2">Technical Analysis</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Strong technical signals combine volume analysis, price action patterns, and momentum indicators. Look for clear breakout points and established support/resistance levels. Consider multiple timeframes to confirm trends and identify optimal entry points.
            </p>
          </div>

          <div className="bg-black/30 border border-gold/20 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gold mb-2">Fundamental Analysis</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Focus on project development activity, team updates, and community growth metrics. Track social engagement trends and analyze market positioning. Consider the broader market context and potential catalysts for price movement.
            </p>
          </div>

          <div className="bg-black/30 border border-gold/20 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gold mb-2">Quality Guidelines</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Provide specific entry and exit points with clear reasoning. Support your analysis with multiple indicators and consider overall market conditions. Keep your signals updated as market conditions evolve.
            </p>
          </div>
        </div>

        {/* Stats and Form Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stats */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Performance Metrics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/30 border border-gold/20 rounded-lg p-4">
                <p className="text-sm text-gray-400">Success Rate</p>
                <p className="text-2xl font-bold text-gold">XX%</p>
              </div>
              <div className="bg-black/30 border border-gold/20 rounded-lg p-4">
                <p className="text-sm text-gray-400">Active Signals</p>
                <p className="text-2xl font-bold text-gold">XX</p>
              </div>
            </div>
          </div>

          {/* Signal Form */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Submit Signal</h2>
            <SignalForm />
          </div>
        </div>

        {/* Signal History */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Recent Signals</h2>
          <SignalHistory />
        </div>

        {/* Bottom Notice */}
        <div className="bg-darkred/10 border border-gold/20 rounded-lg p-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            High-quality signals that lead to profitable trades increase your profit share allocation. Focus on AI tokens with strong fundamentals and back your analysis with on-chain data. Regular updates to your active signals help maintain signal quality and improve community trading success.
          </p>
        </div>
      </div>
    </main>
  )
}
