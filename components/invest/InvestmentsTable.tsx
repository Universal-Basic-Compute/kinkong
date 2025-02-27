'use client';
import { useState, useEffect } from 'react';
import { TokenDisplay } from '@/utils/tokenDisplay';

interface Investment {
  investmentId: string;
  amount: number;
  token?: string; // Token type (UBC, COMPUTE, USDC)
  usdAmount?: number; // USD equivalent amount
  solscanUrl: string;
  date: string;
  username?: string;
  wallet: string;
  return?: number; // USDC return
  ubcReturn?: number; // UBC return
}

interface WalletSnapshot {
  totalValue: number;
  timestamp: string;
}

interface InvestmentsTableProps {
  investments: Investment[];
  latestSnapshot: WalletSnapshot | null;
  isLoading: boolean;
}

export function InvestmentsTable({ investments, latestSnapshot, isLoading }: InvestmentsTableProps) {
  const validateInvestment = (inv: any): inv is Investment => {
    return (
      typeof inv.investmentId === 'string' &&
      typeof inv.amount === 'number' &&
      typeof inv.solscanUrl === 'string' &&
      typeof inv.date === 'string' &&
      typeof inv.wallet === 'string'
    );
  };

  return (
    <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
      {isLoading ? (
        <div className="text-center">Loading investors...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gold/20">
                  <th className="px-4 py-3 text-left font-bold">Username</th>
                  <th className="px-4 py-3 text-right font-bold">Initial Investment</th>
                  <th className="px-4 py-3 text-right font-bold">Return</th>
                  <th className="px-4 py-3 text-left font-bold">Date</th>
                  <th className="px-4 py-3 text-left font-bold">Transaction</th>
                </tr>
              </thead>
              <tbody>
                {investments
                  .filter(validateInvestment)
                  .sort((a, b) => (b.usdAmount || 0) - (a.usdAmount || 0)) // Sort by usdAmount in descending order
                  .map((investment) => (
                  <tr key={investment.investmentId} className="border-b border-gold/10 hover:bg-gold/5">
                    <td className="px-4 py-4 text-white">
                      {investment.wallet ? (
                        <a 
                          href={`https://solscan.io/account/${investment.wallet}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-gold transition-colors"
                          title="View wallet on Solscan"
                        >
                          {`${investment.wallet.substring(0, 4)}...${investment.wallet.substring(investment.wallet.length - 4)}`}
                        </a>
                      ) : (
                        'Anonymous'
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {typeof investment.amount === 'number' ? (
                        <>
                          <div>
                            <span className="text-white font-medium">{Math.floor(investment.amount).toLocaleString('en-US')}</span>{' '}
                            <TokenDisplay 
                              token={investment.token || 'USDC'} 
                              options={{ className: 'text-gray-400' }}
                            />
                          </div>
                          {investment.usdAmount && (
                            <div className="text-gray-400 text-sm">
                              (${Math.floor(investment.usdAmount).toLocaleString('en-US')})
                            </div>
                          )}
                        </>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {investment.ubcReturn !== undefined ? (
                        <>
                          <span className="metallic-text-ubc font-medium">
                            {Math.floor(investment.ubcReturn).toLocaleString('en-US')} $UBC
                          </span> 
                          <span className="text-gray-400 text-sm ml-1">
                            (${investment.return ? Math.floor(investment.return).toLocaleString('en-US') : '0'})
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400">Calculating...</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {investment.date 
                        ? new Date(investment.date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }).replace(/\//g, '/')
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-4">
                      <a 
                        href={investment.solscanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold hover:text-gold/80 font-medium"
                      >
                        View on Solscan
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {latestSnapshot && (
            <div className="mt-6 text-sm space-y-1">
              <p>
                <span className="text-gray-400">Portfolio Value:</span> 
                <span className="text-white ml-2 font-medium">{Math.floor(latestSnapshot.totalValue).toLocaleString('en-US')}</span> 
                <span className="text-gray-400">$USDC</span>
              </p>
              <p>
                <span className="text-gray-400">Total Investment:</span> 
                <span className="text-white ml-2 font-medium">
                  {Math.floor(investments.reduce((sum, inv) => sum + (inv.usdAmount || 0), 0)).toLocaleString('en-US')}
                </span> 
                <span className="text-gray-400">$USDC</span>
              </p>
              <p className="text-gray-400">
                Last Updated: {new Date(latestSnapshot.timestamp).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                }).replace(/\//g, '/')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
