import { AllocationChart } from '@/components/dashboard/AllocationChart'
import { SignalForm } from '@/components/signals/SignalForm'
import { TradeHistory } from '@/components/tables/TradeHistory'

export default function Dashboard() {
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-8">Holder Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <h3>Your Investment</h3>
          <p className="text-2xl">XX,XXX COMPUTE</p>
        </div>
        <div className="stat-card">
          <h3>Signal Success Rate</h3>
          <p className="text-2xl">XX%</p>
        </div>
        <div className="stat-card">
          <h3>Pending Profits</h3>
          <p className="text-2xl">XX SOL</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <section>
          <h2 className="text-2xl font-bold mb-4">Current Allocation</h2>
          <AllocationChart />
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">Submit Signal</h2>
          <SignalForm />
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Your Recent Signals</h2>
        <TradeHistory userOnly={true} />
      </section>
    </main>
  )
}
