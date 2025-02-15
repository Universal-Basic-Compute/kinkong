'use client';
import dynamic from 'next/dynamic';

// Dynamically import the provider component with ssr disabled
const WalletProviderComponent = dynamic(
  () => import('./WalletProviderComponent').then(mod => mod.WalletProviderComponent),
  { ssr: false }
);

export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  return <WalletProviderComponent>{children}</WalletProviderComponent>;
}
