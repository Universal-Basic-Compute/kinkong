'use client';

import React from 'react';
import { useOnboarding, OnboardingStep } from '@/app/context/OnboardingContext';

const OnboardingProgress: React.FC = () => {
  const { currentStep } = useOnboarding();
  
  // Define the steps for the progress bar (excluding welcome and complete)
  const steps = [
    { id: OnboardingStep.EXPERIENCE, label: 'Experience' },
    { id: OnboardingStep.INTERESTS, label: 'Interests' },
    { id: OnboardingStep.INCOME_SOURCE, label: 'Income' },
    { id: OnboardingStep.RISK_TOLERANCE, label: 'Risk' }
  ];
  
  // Find the current step index
  const currentIndex = steps.findIndex(step => step.id === currentStep);
  
  // Calculate progress percentage
  const progressPercentage = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className="mb-8">
      <div className="flex justify-between mb-2">
        {steps.map((step, index) => (
          <div 
            key={step.id} 
            className={`text-xs md:text-sm font-medium ${
              index <= currentIndex ? 'text-gold' : 'text-gray-400'
            }`}
          >
            {step.label}
          </div>
        ))}
      </div>
      
      <div className="w-full bg-gray-700 rounded-full h-2.5">
        <div 
          className="bg-gradient-to-r from-gold to-amber-500 h-2.5 rounded-full transition-all duration-500 ease-in-out"
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default OnboardingProgress;
