'use client';

import React, { useState } from 'react';
import { useOnboarding } from '@/app/context/OnboardingContext';

const ExperienceStep: React.FC = () => {
  const { onboardingData, updateOnboardingData, nextStep, prevStep } = useOnboarding();
  const [selectedExperience, setSelectedExperience] = useState<string>(onboardingData.experience || '');

  const experienceLevels = [
    {
      id: 'beginner',
      title: 'Beginner',
      description: 'New to trading or have limited experience',
      icon: '🌱'
    },
    {
      id: 'intermediate',
      title: 'Intermediate',
      description: 'Some trading experience but looking to improve',
      icon: '📈'
    },
    {
      id: 'advanced',
      title: 'Advanced',
      description: 'Experienced trader seeking advanced insights',
      icon: '🚀'
    }
  ];

  const handleContinue = () => {
    if (selectedExperience) {
      updateOnboardingData({ experience: selectedExperience });
      nextStep();
    }
  };

  return (
    <div className="space-y-6 py-4">
      <h2 className="text-2xl md:text-3xl font-bold text-center">
        What's your trading experience?
      </h2>
      
      <p className="text-gray-300 text-center max-w-2xl mx-auto">
        This helps us tailor KinKong's responses to your knowledge level.
      </p>
      
      <div className="grid gap-4 md:grid-cols-3 mt-6">
        {experienceLevels.map((level) => (
          <div
            key={level.id}
            className={`p-4 rounded-lg border cursor-pointer transition-all duration-300 hover:scale-105 ${
              selectedExperience === level.id
                ? 'border-gold bg-black/50 shadow-lg shadow-gold/20'
                : 'border-gray-700 bg-black/30 hover:border-gray-500'
            }`}
            onClick={() => setSelectedExperience(level.id)}
          >
            <div className="text-3xl mb-2">{level.icon}</div>
            <h3 className="text-lg font-semibold mb-1">{level.title}</h3>
            <p className="text-sm text-gray-400">{level.description}</p>
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
          disabled={!selectedExperience}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            selectedExperience
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

export default ExperienceStep;
