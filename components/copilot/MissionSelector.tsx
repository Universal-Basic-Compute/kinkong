'use client';

import React from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { useChat } from '@/app/context/ChatContext';

export default function MissionSidebar() {
  const { selectedMissionId, handleSelectMission } = useChat();

  const missions = [
    {
      id: 'token-discovery',
      title: '🔍 Token Discovery',
      description: 'Find promising new tokens with strong fundamentals',
      context: 'Help me analyze emerging tokens on Solana with strong fundamentals. Let\'s evaluate liquidity, volume trends, and holder distribution to create a watchlist of promising tokens for potential investment.'
    },
    {
      id: 'portfolio-rebalancing',
      title: '⚖️ Portfolio Rebalancing',
      description: 'Optimize your current portfolio allocation',
      context: 'I need help assessing my current portfolio allocation and performance. Let\'s identify underperforming assets and potential replacements to create a step-by-step rebalancing plan based on current market conditions.'
    },
    {
      id: 'technical-analysis',
      title: '📊 Technical Analysis',
      description: 'Learn to identify key chart patterns',
      context: 'I want to learn how to identify key chart patterns on specific tokens. Let\'s practice support/resistance identification and develop a personalized trading strategy based on technical indicators.',
      disabled: true
    },
    {
      id: 'risk-management',
      title: '🛡️ Risk Management',
      description: 'Improve your position sizing and stop-loss strategies',
      context: 'Help me evaluate my current position sizing and stop-loss strategies. I want to calculate optimal risk-reward ratios based on volatility and create a risk management framework aligned with my risk tolerance.',
      disabled: true
    },
    {
      id: 'defi-yield',
      title: '💰 DeFi Yield',
      description: 'Find the best yield opportunities on Solana',
      context: 'Let\'s discover the highest-yielding DeFi protocols on Solana. I want to compare risks and rewards across lending platforms and liquidity pools to develop a yield farming strategy based on my risk profile.'
    },
    {
      id: 'sentiment-analysis',
      title: '🔮 Market Sentiment',
      description: 'Track social media trends and community sentiment',
      context: 'I want to track social media trends and community sentiment for key tokens. Let\'s correlate sentiment indicators with price action and create alerts for significant sentiment shifts that could impact prices.',
      disabled: true
    },
    {
      id: 'swing-trading',
      title: '🔄 Swing Trading',
      description: 'Identify potential swing trading opportunities',
      context: 'Help me identify potential swing trading opportunities in the current market. Let\'s analyze optimal entry and exit points with specific price targets and develop a tracking system for managing multiple swing positions.'
    },
    {
      id: 'on-chain-data',
      title: '🐋 On-Chain Data',
      description: 'Explore whale wallet movements and smart money flows',
      context: 'Let\'s explore whale wallet movements and smart money flows. I want to analyze token distribution and concentration metrics to identify potential accumulation or distribution patterns before they affect price.',
      disabled: true
    }
  ];

  return (
    <div className="w-72 bg-black/40 border-r border-gold/20 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3 mt-4">
        <h2 className="text-lg font-semibold text-gold">Select a Mission</h2>
        <Tooltip 
          content="Selecting a mission provides KinKong with specialized data and context, focusing the conversation on specific goals and strategies for better results."
          position="right"
        >
          <div className="text-gray-400 cursor-help hover:text-gold transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
        </Tooltip>
      </div>
      <div className="space-y-3">
        {missions.map((mission) => (
          <div
            key={mission.id}
            onClick={(e) => {
              e.preventDefault(); // Prevent default behavior
              if (!mission.disabled) {
                handleSelectMission(mission.title, mission.context, mission.id);
              }
            }}
            className={`p-3 rounded-lg ${
              mission.disabled 
                ? 'bg-black/20 border border-gray-700/30 text-gray-500 cursor-not-allowed opacity-60'
                : selectedMissionId === mission.id
                  ? 'bg-gold/20 border-2 border-gold text-gold font-medium cursor-pointer'
                  : 'bg-black/50 border border-gold/20 hover:bg-gold/10 hover:border-gold/40 text-gold cursor-pointer'
            } transition-all`}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-medium">{mission.title}</h3>
              {mission.disabled && (
                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">Coming Soon</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
