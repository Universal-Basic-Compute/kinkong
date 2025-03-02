'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface WhaleAnalysisTableProps {
  data: any[];
  isLoading: boolean;
}

export function WhaleAnalysisTable({ data, isLoading }: WhaleAnalysisTableProps) {
  const [sortField, setSortField] = useState('holdingAmount');
  const [sortDirection, setSortDirection] = useState('desc');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  
  const sortedData = useMemo(() => {
    if (!data) return [];
    
    return [...data].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Handle date fields
      if (sortField === 'createdAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      // Handle numeric fields
      if (sortField === 'confidenceScore' || sortField === 'holdingAmount') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortField, sortDirection]);
  
  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage;
    return sortedData.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedData, page]);
  
  const totalPages = useMemo(() => {
    return Math.ceil((sortedData?.length || 0) / rowsPerPage);
  }, [sortedData]);
  
  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const toggleRowExpanded = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  if (isLoading) {
    return (
      <div className="bg-black/30 p-6 rounded-lg border border-gold/20 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-700/20 rounded"></div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-black/30 p-6 rounded-lg border border-gold/20">
      <h3 className="text-xl font-bold mb-4">Whale Analysis Details</h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <button 
                  className="flex items-center space-x-1"
                  onClick={() => handleSort('createdAt')}
                >
                  <span>Date</span>
                  {sortField === 'createdAt' && (
                    sortDirection === 'asc' ? 
                    <ChevronUpIcon className="h-4 w-4" /> : 
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <button 
                  className="flex items-center space-x-1"
                  onClick={() => handleSort('token')}
                >
                  <span>Token</span>
                  {sortField === 'token' && (
                    sortDirection === 'asc' ? 
                    <ChevronUpIcon className="h-4 w-4" /> : 
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <button 
                  className="flex items-center space-x-1"
                  onClick={() => handleSort('holdingAmount')}
                >
                  <span>Holding</span>
                  {sortField === 'holdingAmount' && (
                    sortDirection === 'asc' ? 
                    <ChevronUpIcon className="h-4 w-4" /> : 
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <button 
                  className="flex items-center space-x-1"
                  onClick={() => handleSort('holdingPattern')}
                >
                  <span>Pattern</span>
                  {sortField === 'holdingPattern' && (
                    sortDirection === 'asc' ? 
                    <ChevronUpIcon className="h-4 w-4" /> : 
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <button 
                  className="flex items-center space-x-1"
                  onClick={() => handleSort('tradingActivity')}
                >
                  <span>Activity</span>
                  {sortField === 'tradingActivity' && (
                    sortDirection === 'asc' ? 
                    <ChevronUpIcon className="h-4 w-4" /> : 
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <button 
                  className="flex items-center space-x-1"
                  onClick={() => handleSort('outlook')}
                >
                  <span>Outlook</span>
                  {sortField === 'outlook' && (
                    sortDirection === 'asc' ? 
                    <ChevronUpIcon className="h-4 w-4" /> : 
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <button 
                  className="flex items-center space-x-1"
                  onClick={() => handleSort('confidenceScore')}
                >
                  <span>Confidence</span>
                  {sortField === 'confidenceScore' && (
                    sortDirection === 'asc' ? 
                    <ChevronUpIcon className="h-4 w-4" /> : 
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                <span>Details</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <React.Fragment key={item.id}>
                  <tr className="hover:bg-black/40">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`metallic-text-${item.token?.toLowerCase()}`}>
                        ${item.token}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                      {Number(item.holdingAmount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        item.holdingPattern === 'ACCUMULATION' ? 'bg-green-900/30 text-green-400' :
                        item.holdingPattern === 'DISTRIBUTION' ? 'bg-red-900/30 text-red-400' :
                        'bg-blue-900/30 text-blue-400'
                      }`}>
                        {item.holdingPattern}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        item.tradingActivity === 'HIGH' ? 'bg-purple-900/30 text-purple-400' :
                        item.tradingActivity === 'MEDIUM' ? 'bg-blue-900/30 text-blue-400' :
                        'bg-gray-900/30 text-gray-400'
                      }`}>
                        {item.tradingActivity}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        item.outlook === 'BULLISH' ? 'bg-green-900/30 text-green-400' :
                        item.outlook === 'BEARISH' ? 'bg-red-900/30 text-red-400' :
                        'bg-blue-900/30 text-blue-400'
                      }`}>
                        {item.outlook}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                      {item.confidenceScore}/100
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <button
                        onClick={() => toggleRowExpanded(item.id)}
                        className="text-gold hover:text-gold/80"
                      >
                        {expandedRows[item.id] ? 'Hide' : 'Show'}
                      </button>
                    </td>
                  </tr>
                  {expandedRows[item.id] && (
                    <tr className="bg-black/40">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="text-sm text-gray-300">
                          <h4 className="font-medium text-gold mb-2">Analysis</h4>
                          <p className="mb-4 whitespace-pre-line">{item.explanation}</p>
                          
                          <h4 className="font-medium text-gold mb-2">Key Insights</h4>
                          <ul className="list-disc pl-5 mb-4 space-y-1">
                            {item.keyInsights?.split('\n').map((insight, i) => (
                              <li key={i}>{insight}</li>
                            ))}
                          </ul>
                          
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-gray-400">Wallet:</span>{' '}
                              <a 
                                href={`https://solscan.io/account/${item.wallet}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gold hover:text-gold/80 underline"
                              >
                                {item.wallet.substring(0, 8)}...{item.wallet.substring(item.wallet.length - 8)}
                              </a>
                            </div>
                            <div>
                              <span className="text-gray-400">Recommended Action:</span>{' '}
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                item.recommendedAction === 'FOLLOW' ? 'bg-green-900/30 text-green-400' :
                                item.recommendedAction === 'IGNORE' ? 'bg-red-900/30 text-red-400' :
                                'bg-blue-900/30 text-blue-400'
                              }`}>
                                {item.recommendedAction}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No whale analysis data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-400">
            Showing {((page - 1) * rowsPerPage) + 1} to {Math.min(page * rowsPerPage, sortedData.length)} of {sortedData.length} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className={`px-3 py-1 rounded-lg ${
                page === 1 ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className={`px-3 py-1 rounded-lg ${
                page === totalPages ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
