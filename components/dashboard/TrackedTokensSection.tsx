import { ForceGraph } from '@/components/dashboard/ForceGraph';
import { TokenInfoTable } from '@/components/dashboard/TokenInfoTable';

interface TokenInfo {
  symbol: string;
  name: string;
  mint: string;
  volume7d: number;
  liquidity: number;
  volumeGrowth: number;
  pricePerformance: number;
  marketCap: number;
}

interface TrackedTokensSectionProps {
  tokens: TokenInfo[];
  isLoading: boolean;
  error: string | null;
}

export function TrackedTokensSection({ tokens, isLoading, error }: TrackedTokensSectionProps) {
  return (
    <section className="mb-16">
      <div className="flex items-center gap-2 mb-8">
        <h2 className="text-2xl font-bold">Tracked Tokens</h2>
        <div className="group relative">
          <div className="cursor-help text-gray-400 border border-gray-400 rounded-full w-4 h-4 flex items-center justify-center text-xs">
            i
          </div>
          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-black/90 border border-gold/20 rounded-lg text-xs text-gray-300 z-10">
            List of all AI tokens currently tracked by KinKong for potential trading opportunities.
          </div>
        </div>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-400">Error: {error}</div>
      ) : (
        <ForceGraph tokens={tokens} />
      )}

      <TokenInfoTable tokens={tokens} isLoading={isLoading} error={error} />
    </section>
  );
}
