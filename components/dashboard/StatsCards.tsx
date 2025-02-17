interface StatsCardsProps {
  investmentComponent: React.ReactNode;
}

export function StatsCards({ investmentComponent }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-6 mb-16">
      {investmentComponent}
      <div className="stat-card">
        <h3>Signal Success Rate</h3>
        <p className="text-2xl">XX%</p>
      </div>
      <div className="stat-card">
        <h3>Pending Profits</h3>
        <p className="text-2xl">XX SOL</p>
      </div>
    </div>
  );
}
