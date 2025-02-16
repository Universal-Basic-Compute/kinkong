import { SignalForm } from '@/components/signals/SignalForm'
import { SignalHistory } from '@/components/signals/SignalHistory'

export default function Signals() {
  return (
    <main className="min-h-screen p-4 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Community Signals</h1>

      <div className="bg-black/30 border border-gold/20 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">About Community Signals</h2>
        <p className="text-gray-300 mb-4">
          Community Signals is a collaborative platform where KinKong holders can share their trading insights and analysis. 
          High-quality signals that lead to profitable trades are rewarded with additional profit share allocations.
        </p>
        
        <h3 className="text-xl font-bold text-gold mb-3">How to Submit Quality Signals</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div className="space-y-2">
            <h4 className="font-bold">Technical Analysis</h4>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              <li>Volume trends and anomalies</li>
              <li>Price action patterns</li>
              <li>Key support/resistance levels</li>
              <li>Momentum indicators</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold">Fundamental Analysis</h4>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              <li>Project development updates</li>
              <li>Team activity and announcements</li>
              <li>Community growth metrics</li>
              <li>Market sentiment analysis</li>
            </ul>
          </div>
        </div>

        <div className="bg-darkred/10 border border-gold/20 rounded-lg p-4 mt-4">
          <h4 className="font-bold text-gold mb-2">Signal Quality Guidelines</h4>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li>Include specific entry and exit points</li>
            <li>Provide clear reasoning for your analysis</li>
            <li>Back your signal with multiple indicators</li>
            <li>Consider market conditions and timing</li>
            <li>Update your signal if conditions change</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
          <h2 className="text-2xl font-bold mb-4">Submit New Signal</h2>
          <SignalForm />
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">Signal Performance</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="stat-card">
              <h3>Community Success Rate</h3>
              <p className="text-2xl">XX%</p>
            </div>
            <div className="stat-card">
              <h3>Active Signals</h3>
              <p className="text-2xl">XX</p>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Recent Signals</h2>
        <SignalHistory />
      </section>
    </main>
  )
}
