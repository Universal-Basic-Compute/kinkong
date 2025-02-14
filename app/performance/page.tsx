import { PerformanceChart } from '@/components/charts/PerformanceChart'
import { TradeHistory } from '@/components/tables/TradeHistory'

export default function Performance() {
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-8">Performance & Analytics</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Historical Performance</h2>
        <PerformanceChart />
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Key Metrics</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="metric-card">
            <h3>Total Return</h3>
            <p className="text-2xl">XX%</p>
          </div>
          <div className="metric-card">
            <h3>Win Rate</h3>
            <p className="text-2xl">XX%</p>
          </div>
          <div className="metric-card">
            <h3>Sharpe Ratio</h3>
            <p className="text-2xl">X.XX</p>
          </div>
          <div className="metric-card">
            <h3>Max Drawdown</h3>
            <p className="text-2xl">XX%</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Recent Trades</h2>
        <TradeHistory />
      </section>
    </main>
  )
}
