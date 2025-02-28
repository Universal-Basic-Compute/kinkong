'use client';

import React, { useState } from 'react';
import { useOnboarding } from '@/app/context/OnboardingContext';

const IncomeSourceStep: React.FC = () => {
  const { onboardingData, updateOnboardingData, nextStep, prevStep } = useOnboarding();
  const [selected, setSelected] = useState<string>(onboardingData.incomeSource || '');

  const handleSelect = (value: string) => {
    setSelected(value);
    updateOnboardingData({ incomeSource: value });
  };

  const handleNext = () => {
    if (selected) {
      nextStep();
    }
  };

  const options = [
    { value: 'employment', label: '💼 Full-time Employment' },
    { value: 'self-employed', label: '🚀 Self-employed / Business Owner' },
    { value: 'investments', label: '📈 Investment Income' },
    { value: 'crypto-trading', label: '🪙 Crypto Trading' },
    { value: 'multiple-sources', label: '🔄 Multiple Income Sources' },
    { value: 'prefer-not-to-say', label: '🔒 Prefer not to say' }
  ];

  return (
    <div className="space-y-6 py-4">
      <h2 className="text-2xl font-bold text-center text-gold">What's your primary source of income?</h2>
      <p className="text-gray-400 text-center mb-6">
        This helps us understand your financial context and provide more relevant advice.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`p-4 rounded-lg text-left transition-all ${
              selected === option.value
                ? 'bg-gold/20 border-2 border-gold'
                : 'bg-black/30 border border-gold/20 hover:bg-black/50'
            }`}
          >
            <span className="font-medium">{option.label}</span>
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

export default IncomeSourceStep;
