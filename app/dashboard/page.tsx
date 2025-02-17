'use client';
import { AllocationChart } from '@/components/dashboard/AllocationChart'
import { SignalForm } from '@/components/signals/SignalForm'
import { TradeHistory } from '@/components/tables/TradeHistory'
import { TokenTable } from '@/components/tables/TokenTable'
import { useWallet } from '@solana/wallet-adapter-react'
import { useState, useEffect } from 'react'

function InvestmentCard() {
  const { publicKey } = useWallet();
  const [investment, setInvestment] = useState<{
    amount: number;
    date: string;
    solscanUrl: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchInvestment() {
      if (!publicKey) return;

      try {
        const response = await fetch(`/api/user-investment?wallet=${publicKey.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch investment');
        const data = await response.json();
        setInvestment(data);
      } catch (error) {
        console.error('Error fetching investment:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchInvestment();
  }, [publicKey]);

  if (isLoading) {
    return (
      <div className="stat-card">
        <h3>Your Investment</h3>
        <p className="text-2xl">Loading...</p>
      </div>
    );
  }

  if (!investment) {
    return (
      <div className="stat-card">
        <h3>Your Investment</h3>
        <p className="text-2xl">No investment found</p>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <h3>Your Investment</h3>
      <p className="text-2xl">
        {investment.amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} USDC
      </p>
      <a 
        href={investment.solscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gold hover:text-gold/80 underline mt-1 block"
      >
        View on Solscan
      </a>
    </div>
  );
}

export default function Dashboard() {
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-8">Holder Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <InvestmentCard />
        <div className="stat-card">
          <h3>Signal Success Rate</h3>
          <p className="text-2xl">XX%</p>
        </div>
        <div className="stat-card">
          <h3>Pending Profits</h3>
          <p className="text-2xl">XX SOL</p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">KinKong's Current Portfolio</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <AllocationChart />
          </div>
          <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
            <TokenTable />
          </div>
        </div>
      </section>

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
