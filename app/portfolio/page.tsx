import { AllocationChart } from '@/components/dashboard/AllocationChart'
import { TokenTable } from '@/components/tables/TokenTable'
import { PerformanceChart } from '@/components/charts/PerformanceChart'

export default function Portfolio() {
  return (
    <main className="min-h-screen p-4 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">KinKong Portfolio</h1>

      <div className="grid grid-cols-1 gap-8">
        {/* Current Allocation */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Current Allocation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
              <AllocationChart />
            </div>
            <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
              <TokenTable />
            </div>
          </div>
        </section>

        {/* Portfolio Stats */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Portfolio Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <h3>Total Value</h3>
              <p className="text-2xl">$XXX,XXX</p>
            </div>
            <div className="stat-card">
              <h3>24h Change</h3>
              <p className="text-2xl">+X.XX%</p>
            </div>
            <div className="stat-card">
              <h3>7d Performance</h3>
              <p className="text-2xl">+XX.XX%</p>
            </div>
          </div>
        </section>

        {/* Performance Chart */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Portfolio Performance</h2>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            <PerformanceChart />
          </div>
        </section>
      </div>
    </main>
  )
}
