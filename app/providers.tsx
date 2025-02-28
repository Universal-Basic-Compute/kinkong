'use client';

import { SolanaWalletProvider } from '@/components/wallet/WalletProvider';
import { OnboardingProvider } from './context/OnboardingContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SolanaWalletProvider>
      <OnboardingProvider>
        {children}
      </OnboardingProvider>
    </SolanaWalletProvider>
  );
}
