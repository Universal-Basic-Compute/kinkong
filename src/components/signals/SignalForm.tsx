'use client'
import { useState } from 'react'

export function SignalForm() {
  const [formData, setFormData] = useState({
    token: '',
    direction: 'BUY',
    reason: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement signal submission
    console.log('Signal submitted:', formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block mb-2">Token</label>
        <input
          type="text"
          value={formData.token}
          onChange={e => setFormData({...formData, token: e.target.value})}
          className="input-field"
          placeholder="Enter token symbol"
        />
      </div>

      <div>
        <label className="block mb-2">Direction</label>
        <select
          value={formData.direction}
          onChange={e => setFormData({...formData, direction: e.target.value})}
          className="input-field"
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
        />
      </div>

      <button type="submit" className="btn-primary">
        Submit Signal
      </button>
    </form>
  )
}
