import { SignalForm } from '@/components/signals/SignalForm'
import { SignalHistory } from '@/components/signals/SignalHistory'

export default function Signals() {
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-8">Community Signals</h1>

      <div className="grid grid-cols-2 gap-8">
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
