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
              Be part of KinKong's trading intelligence! Share your market insights and influence our trading decisions while earning extra profit share allocations. Together, we're smarter! 🚀
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

        {/* Signal Form Section */}
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold">Submit Signal</h2>
            <div className="group relative">
              <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
                i
              </div>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10">
                A quality signal should include:
                • Clear token symbol and direction (BUY/SELL)
                • Specific reasoning based on technical or fundamental analysis
                • Supporting evidence via reference links
                • Price targets or key levels
                • Risk considerations
                Higher quality signals that lead to profitable trades increase your profit share allocation.
              </div>
            </div>
          </div>
          <SignalForm />
        </div>

        {/* Info Section - Now Last */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="bg-black/30 border border-gold/20 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gold mb-2">Technical Analysis</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Effective technical analysis combines multiple indicators:
              • Volume & liquidity trends to confirm moves
              • Price action patterns (breakouts, reversals)
              • Key support/resistance levels
              • Momentum indicators (RSI, MACD)
              • Multiple timeframe analysis (1H, 4H, 1D)
              • Risk/reward ratio assessment
            </p>
          </div>

          <div className="bg-black/30 border border-gold/20 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gold mb-2">Fundamental Analysis</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Key fundamental factors to consider:
              • Development activity & GitHub metrics
              • Team updates & partnerships
              • Community growth & engagement
              • Token utility & tokenomics
              • Market positioning vs competitors
              • Upcoming catalysts & roadmap
            </p>
          </div>

          <div className="bg-black/30 border border-gold/20 rounded-lg p-4 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gold mb-2">Using Signals</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                • Check signal source credibility
                • Verify analysis with your research
                • Monitor signal updates & changes
                • Consider position sizing
                • Set clear entry/exit points
                • Use stop losses for risk management
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gold mb-2">Creating Quality Signals</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                • Provide clear token symbol & direction
                • Include specific entry/exit prices
                • Back analysis with multiple indicators
                • Add reference links & charts
                • Update signal as conditions change
                • Consider market correlation
              </p>
            </div>
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
