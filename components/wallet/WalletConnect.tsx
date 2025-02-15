'use client'
import dynamic from 'next/dynamic'

// Dynamically import WalletMultiButton with ssr disabled
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export function WalletConnect() {
  return (
    <div className="wallet-connect">
      <WalletMultiButton />
    </div>
  )
}
