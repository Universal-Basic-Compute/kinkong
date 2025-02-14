'use client';

import { SolanaWalletProvider } from '@/components/wallet/WalletProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}
