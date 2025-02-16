import { SignalForm } from '@/components/signals/SignalForm'
import { SignalHistory } from '@/components/signals/SignalHistory'
import { WalletConnect } from '@/components/wallet/WalletConnect'

export default function Signals() {
  return (
    <main className="min-h-screen p-4 max-w-7xl mx-auto">
      <div className="space-y-8">
        {/* Header Section with Wallet Connect */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Community Signals</h1>
            <p className="text-sm text-gray-400">
              Share valuable trading insights with the community and earn additional profit share allocations.
            </p>
          </div>
        </div>

        {/* Signal History Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Recent Signals</h2>
            <div className="group relative">
              <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
                i
              </div>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10">
                Displays both community and KinKong's trading signals. KinKong analyzes and incorporates community signals into its trading decisions, with influence weighted by signal quality and historical accuracy. KinKong signals are highlighted in gold.
              </div>
            </div>
          </div>
          <SignalHistory />
        </div>

        {/* Signal Form - Now Second */}
        <div className="max-w-2xl">
          <h2 className="text-xl font-bold mb-4">Submit Signal</h2>
          <SignalForm />
        </div>

        {/* Info Section - Now Last */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
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
