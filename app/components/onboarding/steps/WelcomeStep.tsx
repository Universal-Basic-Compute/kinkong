'use client';

import React from 'react';
import { useOnboarding } from '@/app/context/OnboardingContext';

const WelcomeStep: React.FC = () => {
  const { nextStep } = useOnboarding();

  return (
    <div className="text-center space-y-6 py-4">
      <img 
        src="/copilot.png" 
        alt="KinKong Copilot" 
        className="w-32 h-32 mx-auto"
      />
      
      <h1 className="text-3xl md:text-4xl font-bold text-gold">
        Welcome to Kong
      </h1>
      
      <p className="text-lg text-gray-300 max-w-2xl mx-auto">
        Let's personalize your experience to help you get the most out of KinKong's trading intelligence.
      </p>
      
      <div className="space-y-4 max-w-md mx-auto">
        <div className="bg-black/40 p-4 rounded-lg border border-gold/30">
          <h3 className="text-lg font-semibold mb-2">What to expect:</h3>
          <ul className="text-left space-y-2 text-gray-300">
            <li className="flex items-start">
              <span className="text-gold mr-2">•</span> 
              A few quick questions about your trading experience
            </li>
            <li className="flex items-start">
              <span className="text-gold mr-2">•</span> 
              Customized insights based on your preferences
            </li>
            <li className="flex items-start">
              <span className="text-gold mr-2">•</span> 
              Personalized trading recommendations
            </li>
          </ul>
        </div>
      </div>
      
      <button
        onClick={nextStep}
        className="mt-6 px-8 py-3 bg-gradient-to-r from-gold to-amber-500 text-black font-bold rounded-lg hover:from-amber-500 hover:to-gold transition-all duration-300 hover:scale-105"
      >
        Let's Get Started
      </button>
    </div>
  );
};

export default WelcomeStep;
