'use client'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { signalEvents } from './SignalHistory'

interface SignalFormData {
  token: string;
  direction: 'BUY' | 'SELL';
  timeframe: 'SCALP' | 'INTRADAY' | 'SWING' | 'POSITION';
  entryPrice: string;
  targetPrice: string;
  stopLoss: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  url: string;
}

function calculateRiskReward(data: SignalFormData): string {
  if (!data.entryPrice || !data.targetPrice || !data.stopLoss) return 'N/A';
  
  const entry = Number(data.entryPrice);
  const target = Number(data.targetPrice);
  const stop = Number(data.stopLoss);
  
  if (isNaN(entry) || isNaN(target) || isNaN(stop)) return 'N/A';
  
  const reward = Math.abs(target - entry);
  const risk = Math.abs(entry - stop);
  
  if (risk === 0) return 'N/A';
  
  const ratio = (reward / risk).toFixed(2);
  return `${ratio}:1`;
}

export function SignalForm() {
  const { connected, publicKey } = useWallet()
  const [formData, setFormData] = useState<SignalFormData>({
    token: '',
    direction: 'BUY',
    timeframe: 'INTRADAY',
    entryPrice: '',
    targetPrice: '',
    stopLoss: '',
    confidence: 'MEDIUM',
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
      // Calculate expiry date based on timeframe
      const now = new Date();
      let expiryDate: Date;
      
      switch (formData.timeframe) {
        case 'SCALP':
          expiryDate = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours
          break;
        case 'INTRADAY':
          expiryDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
          break;
        case 'SWING':
          expiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
          break;
        case 'POSITION':
          expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
          break;
        default:
          expiryDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to 24 hours
      }

      const response = await fetch('/api/signals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          wallet: publicKey.toString(),
          expiryDate: expiryDate.toISOString(),
          status: 'PENDING'
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
        timeframe: 'INTRADAY',
        entryPrice: '',
        targetPrice: '',
        stopLoss: '',
        confidence: 'MEDIUM',
        reason: '',
        url: ''
      })
      setSuccess(true)

      // Emit signal update event
      signalEvents.emit();

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
          onChange={e => setFormData({...formData, direction: e.target.value as 'BUY' | 'SELL'})}
          className="input-field"
          required
        >
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
      </div>

      {/* Timeframe Selection */}
      <div className="mb-6">
        <label className="block mb-2 font-medium">Timeframe</label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: 'SCALP', label: 'Scalp', desc: 'Minutes to hours', emoji: '⚡' },
            { value: 'INTRADAY', label: 'Intraday', desc: 'Hours to 1 day', emoji: '📅' },
            { value: 'SWING', label: 'Swing', desc: 'Days to weeks', emoji: '🌊' },
            { value: 'POSITION', label: 'Position', desc: 'Weeks to months', emoji: '🎯' }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormData({...formData, timeframe: option.value as typeof formData.timeframe})}
              className={`p-3 rounded-lg border ${
                formData.timeframe === option.value
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-gold/20 hover:border-gold/40'
              }`}
            >
              <div className="font-medium">
                {option.emoji} {option.label}
              </div>
              <div className="text-xs text-gray-400">{option.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Price Inputs */}
      <div className="mb-6">
        <label className="block mb-2 font-medium">Price Levels</label>
        <div className="grid grid-cols-3 gap-4">
          <div className="price-input-group">
            <label className="block text-sm text-gray-400 mb-1">Entry Price</label>
            <input
              type="number"
              step="any"
              value={formData.entryPrice}
              onChange={e => setFormData({...formData, entryPrice: e.target.value})}
              className="input-field"
              placeholder="Current/Expected"
            />
          </div>
          <div className="price-input-group">
            <label className="block text-sm text-gray-400 mb-1">Target Price</label>
            <input
              type="number"
              step="any"
              value={formData.targetPrice}
              onChange={e => setFormData({...formData, targetPrice: e.target.value})}
              className="input-field"
              placeholder="Take Profit"
            />
          </div>
          <div className="price-input-group">
            <label className="block text-sm text-gray-400 mb-1">Stop Loss</label>
            <input
              type="number"
              step="any"
              value={formData.stopLoss}
              onChange={e => setFormData({...formData, stopLoss: e.target.value})}
              className="input-field"
              placeholder="Stop Loss"
            />
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          Risk/Reward Ratio: {calculateRiskReward(formData)}
        </div>
      </div>

      {/* Confidence Level */}
      <div className="mb-6">
        <label className="block mb-2 font-medium">Confidence Level</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'LOW', label: 'Low', desc: 'Speculative', color: 'red' },
            { value: 'MEDIUM', label: 'Medium', desc: 'Good Setup', color: 'yellow' },
            { value: 'HIGH', label: 'High', desc: 'Strong Conviction', color: 'green' }
          ].map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setFormData({...formData, confidence: level.value as typeof formData.confidence})}
              className={`p-3 rounded-lg border ${
                formData.confidence === level.value
                  ? `bg-${level.color}-900/50 border-${level.color}-400 text-${level.color}-400`
                  : 'border-gold/20 hover:border-gold/40'
              }`}
            >
              <div className="font-medium">{level.label}</div>
              <div className="text-xs text-gray-400">{level.desc}</div>
            </button>
          ))}
        </div>
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
