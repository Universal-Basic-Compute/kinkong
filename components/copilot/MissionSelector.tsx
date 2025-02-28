'use client';

import { useState } from 'react';

interface MissionSelectorProps {
  onSelectMission: (mission: string, context: string, missionId: string) => void;
}

export default function MissionSelector({ onSelectMission }: MissionSelectorProps) {
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
      context: 'I want to learn how to identify key chart patterns on specific tokens. Let\'s practice support/resistance identification and develop a personalized trading strategy based on technical indicators.'
    },
    {
      id: 'risk-management',
      title: '🛡️ Risk Management',
      description: 'Improve your position sizing and stop-loss strategies',
      context: 'Help me evaluate my current position sizing and stop-loss strategies. I want to calculate optimal risk-reward ratios based on volatility and create a risk management framework aligned with my risk tolerance.'
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
      context: 'I want to track social media trends and community sentiment for key tokens. Let\'s correlate sentiment indicators with price action and create alerts for significant sentiment shifts that could impact prices.'
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
      context: 'Let\'s explore whale wallet movements and smart money flows. I want to analyze token distribution and concentration metrics to identify potential accumulation or distribution patterns before they affect price.'
    }
  ];

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gold mb-3">Select a Mission</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-black/30 border border-gold/10 rounded-lg">
        {missions.map((mission) => (
          <div
            key={mission.id}
            onClick={() => onSelectMission(mission.title, mission.context, mission.id)}
            className="p-3 bg-black/50 border border-gold/20 rounded-lg cursor-pointer hover:bg-gold/10 hover:border-gold/40 transition-all group relative"
          >
            <h3 className="font-medium text-gold">{mission.title}</h3>
            
            {/* Description tooltip on hover */}
            <div className="absolute left-0 right-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
              <div className="bg-black/90 text-gray-200 text-sm p-2 rounded-lg shadow-lg border border-gold/20 mx-3">
                {mission.description}
              </div>
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-black/90 mx-auto"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
