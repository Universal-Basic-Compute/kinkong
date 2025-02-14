export function TokenTable() {
  // Mock data - will be replaced with real API data
  const tokens = [
    { symbol: 'TOKEN1', allocation: 10, performance24h: 5.2 },
    { symbol: 'TOKEN2', allocation: 8, performance24h: -2.1 },
    // ... more tokens
  ]

  return (
    <table className="min-w-full">
      <thead>
        <tr>
          <th>Token</th>
          <th>Allocation (%)</th>
          <th>24h Change</th>
        </tr>
      </thead>
      <tbody>
        {tokens.map(token => (
          <tr key={token.symbol}>
            <td>{token.symbol}</td>
            <td>{token.allocation}%</td>
            <td className={token.performance24h > 0 ? 'text-green-500' : 'text-red-500'}>
              {token.performance24h}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
