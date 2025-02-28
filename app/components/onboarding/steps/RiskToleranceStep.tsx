'use client';

import React, { useState } from 'react';
import { useOnboarding } from '@/app/context/OnboardingContext';

const RiskToleranceStep: React.FC = () => {
  const { onboardingData, updateOnboardingData, nextStep, prevStep } = useOnboarding();
  const [selected, setSelected] = useState<string>(onboardingData.riskTolerance || '');

  const handleSelect = (value: string) => {
    setSelected(value);
    updateOnboardingData({ riskTolerance: value });
  };

  const handleNext = () => {
    if (selected) {
      nextStep();
    }
  };

  const options = [
    { 
      value: 'conservative', 
      label: 'Conservative',
      description: 'I prefer stability and minimal risk, even if returns are lower'
    },
    { 
      value: 'moderate', 
      label: 'Moderate',
      description: 'I can accept some volatility for better returns'
    },
    { 
      value: 'aggressive', 
      label: 'Aggressive',
      description: 'I'm comfortable with high volatility for potentially higher returns'
    },
    { 
      value: 'very-aggressive', 
      label: 'Very Aggressive',
      description: 'I seek maximum returns and can handle extreme volatility'
    }
  ];

  return (
    <div className="space-y-6 py-4">
      <h2 className="text-2xl font-bold text-center text-gold">What's your risk tolerance?</h2>
      <p className="text-gray-400 text-center mb-6">
        This helps us tailor trading suggestions to your comfort level with market volatility.
      </p>

      <div className="space-y-4">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`w-full p-4 rounded-lg text-left transition-all ${
              selected === option.value
                ? 'bg-gold/20 border-2 border-gold'
                : 'bg-black/30 border border-gold/20 hover:bg-black/50'
            }`}
          >
            <div className="font-medium text-lg">{option.label}</div>
            <div className="text-gray-400 text-sm mt-1">{option.description}</div>
          </button>
        ))}
      </div>

      <div className="flex justify-between mt-8">
        <button
          onClick={prevStep}
          className="px-6 py-2 bg-black/50 hover:bg-black/70 border border-gold/30 rounded-lg transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!selected}
          className={`px-8 py-2 rounded-lg font-semibold transition-all ${
            selected
              ? 'bg-gradient-to-r from-gold to-amber-500 text-black hover:opacity-90'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default RiskToleranceStep;
