'use client';

import React, { useState } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { useChat } from '@/app/context/ChatContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function MissionSidebar() {
  const { selectedMissionId, handleSelectMission } = useChat();
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  const missions = [
    {
      id: 'token-discovery',
      title: '🔍 Token Discovery',
      description: 'Find promising new tokens with strong fundamentals',
      context: 'Help me analyze emerging tokens on Solana with strong fundamentals. Let\'s evaluate liquidity, volume trends, and holder distribution to create a watchlist of promising tokens for potential investment.',
      submenu: [
        {
          id: 'new-listings',
          title: 'New Listings',
          context: 'Show me the newest token listings on Solana with strong fundamentals and potential for growth.'
        },
        {
          id: 'volume-growth',
          title: 'Volume Growth',
          context: 'Which tokens are showing the strongest volume growth in the past week? Let\'s analyze if this indicates potential price movement.'
        },
        {
          id: 'holder-analysis',
          title: 'Holder Analysis',
          context: 'Help me analyze tokens with healthy holder distribution patterns that suggest long-term sustainability.'
        },
        {
          id: 'liquidity-depth',
          title: 'Liquidity Depth',
          context: 'Which tokens have the best liquidity depth relative to their market cap? I want to find tokens with good trading conditions.'
        }
      ]
    },
    {
      id: 'portfolio-rebalancing',
      title: '⚖️ Portfolio Rebalancing',
      description: 'Optimize your current portfolio allocation',
      context: 'I need help assessing my current portfolio allocation and performance. Let\'s identify underperforming assets and potential replacements to create a step-by-step rebalancing plan based on current market conditions.',
      submenu: [
        {
          id: 'performance-review',
          title: 'Performance Review',
          context: 'Help me review the performance of my current portfolio holdings and identify underperforming assets.'
        },
        {
          id: 'allocation-strategy',
          title: 'Allocation Strategy',
          context: 'What would be an optimal allocation strategy for my portfolio based on current market conditions?'
        },
        {
          id: 'risk-assessment',
          title: 'Risk Assessment',
          context: 'Analyze the risk level of my current portfolio and suggest adjustments to better align with my risk tolerance.'
        },
        {
          id: 'rebalance-plan',
          title: 'Rebalance Plan',
          context: 'Create a step-by-step plan to rebalance my portfolio for optimal performance in the current market.'
        }
      ]
    },
    {
      id: 'strategy-optimization',
      title: '⚙️ Strategy Optimization',
      description: 'Analyze and optimize KinKong\'s trading strategy',
      context: 'Help me analyze and optimize KinKong\'s trading strategy. I want to understand the current implementation and find ways to improve performance, efficiency, and results across different components of the system.',
      submenu: [
        {
          id: 'engine-optimization',
          title: 'Engine Optimization',
          context: 'Let\'s analyze KinKong\'s trading engine implementation. I want to understand how the core algorithms work and identify potential optimizations for better performance and reliability.'
        },
        {
          id: 'timing-optimization',
          title: 'Timing Optimization',
          context: 'Help me optimize the timing aspects of KinKong\'s strategy. I want to analyze entry/exit timing, rebalancing frequency, and market cycle adaptation to improve overall returns.'
        },
        {
          id: 'socials-optimization',
          title: 'Socials Optimization',
          context: 'Let\'s review KinKong\'s social media integration and sentiment analysis. I want to optimize how we gather, process, and act on social signals to improve trading decisions.'
        },
        {
          id: 'whales-optimization',
          title: 'Whales Optimization',
          context: 'Help me optimize KinKong\'s whale tracking and analysis capabilities. I want to better identify and follow smart money movements to improve our strategy.'
        }
      ]
    },
    {
      id: 'technical-analysis',
      title: '📊 Technical Analysis',
      description: 'Learn to identify key chart patterns',
      context: 'I want to learn how to identify key chart patterns on specific tokens. Let\'s practice support/resistance identification and develop a personalized trading strategy based on technical indicators.',
      disabled: true,
      submenu: []
    },
    {
      id: 'risk-management',
      title: '🛡️ Risk Management',
      description: 'Improve your position sizing and stop-loss strategies',
      context: 'Help me evaluate my current position sizing and stop-loss strategies. I want to calculate optimal risk-reward ratios based on volatility and create a risk management framework aligned with my risk tolerance.',
      disabled: true,
      submenu: []
    },
    {
      id: 'defi-yield',
      title: '💰 DeFi Yield',
      description: 'Find the best yield opportunities on Solana',
      context: 'Let\'s discover the highest-yielding DeFi protocols on Solana. I want to compare risks and rewards across lending platforms and liquidity pools to develop a yield farming strategy based on my risk profile.',
      submenu: [
        {
          id: 'lending-platforms',
          title: 'Lending Platforms',
          context: 'What are the best lending platforms on Solana right now in terms of yield and security?'
        },
        {
          id: 'liquidity-pools',
          title: 'Liquidity Pools',
          context: 'Help me find the most profitable liquidity pools on Solana with a good balance of risk and reward.'
        },
        {
          id: 'yield-farming',
          title: 'Yield Farming',
          context: 'What are the current best yield farming strategies on Solana for someone with my risk profile?'
        },
        {
          id: 'staking-options',
          title: 'Staking Options',
          context: 'What are the best staking options on Solana for generating passive income?'
        }
      ]
    },
    {
      id: 'sentiment-analysis',
      title: '🔮 Market Sentiment',
      description: 'Track social media trends and community sentiment',
      context: 'I want to track social media trends and community sentiment for key tokens. Let\'s correlate sentiment indicators with price action and create alerts for significant sentiment shifts that could impact prices.',
      disabled: true,
      submenu: []
    },
    {
      id: 'swing-trading',
      title: '🔄 Swing Trading',
      description: 'Identify potential swing trading opportunities',
      context: 'Help me identify potential swing trading opportunities in the current market. Let\'s analyze optimal entry and exit points with specific price targets and develop a tracking system for managing multiple swing positions.',
      submenu: [
        {
          id: 'market-opportunities',
          title: 'Market Opportunities',
          context: 'What are the best swing trading opportunities in the current market based on technical analysis?'
        },
        {
          id: 'entry-exit',
          title: 'Entry & Exit Points',
          context: 'Help me identify optimal entry and exit points for swing trades with specific price targets.'
        },
        {
          id: 'position-tracking',
          title: 'Position Tracking',
          context: 'How can I develop an effective system for tracking multiple swing positions?'
        },
        {
          id: 'risk-reward',
          title: 'Risk-Reward Analysis',
          context: 'Help me calculate risk-reward ratios for potential swing trades to maximize profitability.'
        }
      ]
    },
    {
      id: 'on-chain-data',
      title: '🐋 On-Chain Data',
      description: 'Explore whale wallet movements and smart money flows',
      context: 'Let\'s explore whale wallet movements and smart money flows. I want to analyze token distribution and concentration metrics to identify potential accumulation or distribution patterns before they affect price.',
      disabled: true,
      submenu: []
    }
  ];

  const handleMissionClick = (missionId: string) => {
    if (!missions.find(m => m.id === missionId)?.disabled) {
      setActiveSubmenu(missionId);
    }
  };

  const handleSubmenuItemClick = (mission: any, submenuItem: any) => {
    // Combine the mission context with the submenu context for more specific guidance
    const combinedContext = `${mission.context}\n\nSpecifically, ${submenuItem.context}`;
    handleSelectMission(mission.title, combinedContext, mission.id);
    // Keep the submenu open after selection
  };

  const handleBackToMainMenu = () => {
    setActiveSubmenu(null);
  };

  // Find the active mission for submenu display
  const activeMission = missions.find(mission => mission.id === activeSubmenu);

  return (
    <div className="w-72 bg-black/40 border-r border-gold/20 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3 mt-4">
        <h2 className="text-lg font-semibold text-gold">
          {activeSubmenu ? activeMission?.title || 'Mission Options' : 'Select a Mission'}
        </h2>
        <Tooltip 
          content={activeSubmenu 
            ? "Choose a specific focus area for your mission" 
            : "Selecting a mission provides KinKong with specialized data and context, focusing the conversation on specific goals and strategies for better results."}
          position="right"
        >
          <div className="text-gray-400 cursor-help hover:text-gold transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
        </Tooltip>
      </div>

      <AnimatePresence mode="wait">
        {activeSubmenu ? (
          // Submenu view
          <motion.div
            key="submenu"
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {/* Back button */}
            <button
              onClick={handleBackToMainMenu}
              className="flex items-center text-gold hover:text-gold/80 transition-colors mb-4"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Back to Missions
            </button>

            {/* Description of the selected mission */}
            <div className="p-3 rounded-lg bg-black/30 border border-gold/20 mb-4">
              <p className="text-gray-300 text-sm">
                {activeMission?.description}
              </p>
            </div>

            {/* Submenu items */}
            {activeMission?.submenu.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSubmenuItemClick(activeMission, item)}
                className={`p-3 rounded-lg bg-black/50 border border-gold/20 hover:bg-gold/10 hover:border-gold/40 text-gold cursor-pointer transition-all ${
                  selectedMissionId === activeMission.id ? 'border-l-4 border-l-gold' : ''
                }`}
              >
                <h3 className="font-medium">{item.title}</h3>
                <p className="text-xs text-gray-400 mt-1">{item.context.substring(0, 60)}...</p>
              </div>
            ))}
          </motion.div>
        ) : (
          // Main menu view
          <motion.div
            key="mainmenu"
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {missions.map((mission) => (
              <div
                key={mission.id}
                onClick={() => handleMissionClick(mission.id)}
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
                  {mission.disabled ? (
                    <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">Coming Soon</span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gold/70" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
