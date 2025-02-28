'use client';

import React, { useState } from 'react';
import { useOnboarding } from '@/app/context/OnboardingContext';

const TimeframeStep: React.FC = () => {
  const { onboardingData, updateOnboardingData, nextStep, prevStep } = useOnboarding();
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(onboardingData.timeframe || '');

  const timeframeOptions = [
    {
      id: 'scalping',
      label: 'Scalping',
      description: 'Very short-term trades (minutes to hours)',
      icon: '⚡'
    },
    {
      id: 'day-trading',
      label: 'Day Trading',
      description: 'Completing trades within a single day',
      icon: '📅'
    },
    {
      id: 'swing-trading',
      label: 'Swing Trading',
      description: 'Holding positions for days to weeks',
      icon: '🔄'
    },
    {
      id: 'position-trading',
      label: 'Position Trading',
      description: 'Holding positions for weeks to months',
      icon: '📊'
    },
    {
      id: 'long-term',
      label: 'Long-term Investing',
      description: 'Holding positions for months to years',
      icon: '🏦'
    }
  ];

  const handleContinue = () => {
    if (selectedTimeframe) {
      updateOnboardingData({ timeframe: selectedTimeframe });
      nextStep();
    }
  };

  return (
    <div className="space-y-6 py-4">
      <h2 className="text-2xl md:text-3xl font-bold text-center">
        What's your preferred trading timeframe?
      </h2>
      
      <p className="text-gray-300 text-center max-w-2xl mx-auto">
        Select the timeframe that best matches your trading style.
      </p>
      
      <div className="space-y-3 mt-6">
        {timeframeOptions.map((timeframe) => (
          <div
            key={timeframe.id}
            className={`p-4 rounded-lg border cursor-pointer transition-all duration-300 ${
              selectedTimeframe === timeframe.id
                ? 'border-gold bg-black/50 shadow-lg shadow-gold/20'
                : 'border-gray-700 bg-black/30 hover:border-gray-500'
            }`}
            onClick={() => setSelectedTimeframe(timeframe.id)}
          >
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{timeframe.icon}</span>
              <div>
                <h3 className="font-semibold">{timeframe.label}</h3>
                <p className="text-sm text-gray-400">{timeframe.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex justify-between mt-8">
        <button
          onClick={prevStep}
          className="px-6 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Back
        </button>
        
        <button
          onClick={handleContinue}
          disabled={!selectedTimeframe}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            selectedTimeframe
              ? 'bg-gradient-to-r from-gold to-amber-500 text-black hover:scale-105'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default TimeframeStep;
