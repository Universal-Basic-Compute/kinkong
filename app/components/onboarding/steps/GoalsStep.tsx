'use client';

import React, { useState } from 'react';
import { useOnboarding } from '@/app/context/OnboardingContext';

const GoalsStep: React.FC = () => {
  const { onboardingData, updateOnboardingData, nextStep, prevStep } = useOnboarding();
  const [selectedGoals, setSelectedGoals] = useState<string[]>(onboardingData.goals || []);

  const goalOptions = [
    { 
      id: 'long-term', 
      label: 'Long-term Investment', 
      description: 'Building wealth over time with strategic investments',
      icon: '📈' 
    },
    { 
      id: 'short-term', 
      label: 'Short-term Trading', 
      description: 'Capitalizing on market movements for quick profits',
      icon: '⚡' 
    },
    { 
      id: 'passive-income', 
      label: 'Passive Income', 
      description: 'Generating consistent returns through staking and yield',
      icon: '💸' 
    },
    { 
      id: 'learning', 
      label: 'Learning & Education', 
      description: 'Understanding crypto markets and improving skills',
      icon: '🧠' 
    }
  ];

  const toggleGoal = (id: string) => {
    setSelectedGoals(prev => 
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleContinue = () => {
    if (selectedGoals.length > 0) {
      updateOnboardingData({ goals: selectedGoals });
      nextStep();
    }
  };

  return (
    <div className="space-y-6 py-4">
      <h2 className="text-2xl md:text-3xl font-bold text-center">
        What are your trading goals?
      </h2>
      
      <p className="text-gray-300 text-center max-w-2xl mx-auto">
        Select your primary objectives. This helps KinKong provide more relevant insights.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {goalOptions.map((goal) => (
          <div
            key={goal.id}
            className={`p-4 rounded-lg border cursor-pointer transition-all duration-300 ${
              selectedGoals.includes(goal.id)
                ? 'border-gold bg-black/50 shadow-lg shadow-gold/20'
                : 'border-gray-700 bg-black/30 hover:border-gray-500'
            }`}
            onClick={() => toggleGoal(goal.id)}
          >
            <div className="flex items-start space-x-3">
              <span className="text-2xl">{goal.icon}</span>
              <div>
                <h3 className="font-semibold">{goal.label}</h3>
                <p className="text-sm text-gray-400">{goal.description}</p>
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
          disabled={selectedGoals.length === 0}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            selectedGoals.length > 0
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

export default GoalsStep;
