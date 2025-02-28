'use client';

import React, { useState, useEffect } from 'react';
import { useOnboarding } from '@/app/context/OnboardingContext';

const InterestsStep: React.FC = () => {
  const { onboardingData, updateOnboardingData, nextStep, prevStep } = useOnboarding();
  const [selectedInterests, setSelectedInterests] = useState<string[]>(onboardingData.interests || []);

  const interestOptions = [
    { id: 'ai-tokens', label: 'AI Tokens', icon: '🤖' },
    { id: 'defi', label: 'DeFi Protocols', icon: '💰' },
    { id: 'nfts', label: 'NFTs', icon: '🖼️' },
    { id: 'memecoins', label: 'Memecoins', icon: '🐶' },
    { id: 'gaming', label: 'Gaming/Metaverse', icon: '🎮' },
    { id: 'infrastructure', label: 'Infrastructure', icon: '🏗️' },
    { id: 'layer2', label: 'Layer 2 Solutions', icon: '⚡' },
    { id: 'privacy', label: 'Privacy Coins', icon: '🔒' }
  ];

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev => 
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleContinue = () => {
    if (selectedInterests.length > 0) {
      updateOnboardingData({ interests: selectedInterests });
      nextStep();
    }
  };

  return (
    <div className="space-y-6 py-4">
      <h2 className="text-2xl md:text-3xl font-bold text-center">
        What are you interested in?
      </h2>
      
      <p className="text-gray-300 text-center max-w-2xl mx-auto">
        Select the areas you'd like KinKong to focus on. Choose as many as you like.
      </p>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        {interestOptions.map((interest) => (
          <div
            key={interest.id}
            className={`p-3 rounded-lg border cursor-pointer transition-all duration-300 ${
              selectedInterests.includes(interest.id)
                ? 'border-gold bg-black/50 shadow-lg shadow-gold/20'
                : 'border-gray-700 bg-black/30 hover:border-gray-500'
            }`}
            onClick={() => toggleInterest(interest.id)}
          >
            <div className="flex items-center space-x-2">
              <span className="text-xl">{interest.icon}</span>
              <span className="font-medium">{interest.label}</span>
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
          disabled={selectedInterests.length === 0}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            selectedInterests.length > 0
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

export default InterestsStep;
