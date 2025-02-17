import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { TokenTable } from '@/components/tables/TokenTable';

export function PortfolioSection() {
  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold mb-8">KinKong's Current Portfolio</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <AllocationChart />
        </div>
        <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
          <TokenTable />
        </div>
      </div>
    </section>
  );
}
