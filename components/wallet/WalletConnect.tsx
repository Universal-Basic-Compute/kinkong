'use client'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export function WalletConnect() {
  return (
    <div className="wallet-connect">
      <WalletMultiButton />
    </div>
  )
}
