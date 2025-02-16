'use client'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletConnect } from '@/components/wallet/WalletConnect'

export function SignalForm() {
  const { connected, publicKey } = useWallet()
  const [formData, setFormData] = useState({
    token: '',
    direction: 'BUY',
    reason: '',
    url: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!connected || !publicKey) return

    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/signals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          wallet: publicKey.toString(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit signal')
      }

      // Clear form and show success
      setFormData({
        token: '',
        direction: 'BUY',
        reason: '',
        url: ''
      })
      setSuccess(true)

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit signal')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!connected) {
    return (
      <div className="space-y-4 p-6 bg-black/30 border border-gold/20 rounded-lg">
        <p className="text-gray-300 mb-4">Connect your wallet to submit signals</p>
        <WalletConnect />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-900/50 border border-red-500/50 rounded text-red-200 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-900/50 border border-green-500/50 rounded text-green-200 text-sm">
          Signal submitted successfully!
        </div>
      )}

      <div>
        <label className="block mb-2">Token</label>
        <input
          type="text"
          value={formData.token}
          onChange={e => setFormData({...formData, token: e.target.value})}
          className="input-field"
          placeholder="Enter token symbol"
          required
        />
      </div>

      <div>
        <label className="block mb-2">Direction</label>
        <select
          value={formData.direction}
          onChange={e => setFormData({...formData, direction: e.target.value})}
          className="input-field"
          required
        >
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
      </div>

      <div>
        <label className="block mb-2">Reason</label>
        <textarea
          value={formData.reason}
          onChange={e => setFormData({...formData, reason: e.target.value})}
          className="input-field"
          placeholder="Explain your signal..."
          rows={3}
          required
        />
      </div>

      <div>
        <label className="block mb-2">Reference URL</label>
        <input
          type="url"
          value={formData.url}
          onChange={e => setFormData({...formData, url: e.target.value})}
          className="input-field"
          placeholder="Add a reference link (Twitter, Discord, etc.)"
        />
      </div>

      <button 
        type="submit" 
        className="btn-primary w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Signal'}
      </button>
    </form>
  )
}
