'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboarding } from '@/app/context/OnboardingContext';

const CompleteStep: React.FC = () => {
  const { onboardingData } = useOnboarding();
  const router = useRouter();

  // Save onboarding data to backend
  useEffect(() => {
    const saveOnboardingData = async () => {
      try {
        // Here you would typically send the data to your backend
        // For now, we'll just log it
        console.log('Saving onboarding data:', onboardingData);
        
        // In a real implementation, you would do something like:
        /*
        await fetch('/api/onboarding', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(onboardingData)
        });
        */
      } catch (error) {
        console.error('Error saving onboarding data:', error);
      }
    };

    saveOnboardingData();
  }, [onboardingData]);

  return (
    <div className="text-center space-y-6 py-8">
      <div className="w-20 h-20 bg-gradient-to-r from-gold to-amber-500 rounded-full flex items-center justify-center mx-auto">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      
      <h1 className="text-3xl md:text-4xl font-bold text-gold">
        All Set!
      </h1>
      
      <p className="text-lg text-gray-300 max-w-2xl mx-auto">
        Thanks for sharing your preferences. KinKong Copilot is now personalized to your trading style.
      </p>
      
      <div className="bg-black/40 p-6 rounded-lg border border-gold/30 max-w-md mx-auto">
        <h3 className="text-xl font-semibold mb-4">Your Profile Summary:</h3>
        <ul className="text-left space-y-3">
          <li className="flex items-start">
            <span className="text-gold mr-2 font-bold">•</span> 
            <div>
              <span className="font-medium">Experience:</span>{' '}
              <span className="text-gray-300 capitalize">{onboardingData.experience}</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="text-gold mr-2 font-bold">•</span> 
            <div>
              <span className="font-medium">Interests:</span>{' '}
              <span className="text-gray-300">
                {onboardingData.interests.map(interest => {
                  // Convert kebab-case to Title Case
                  return interest.split('-')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                }).join(', ')}
              </span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="text-gold mr-2 font-bold">•</span> 
            <div>
              <span className="font-medium">Goals:</span>{' '}
              <span className="text-gray-300">
                {onboardingData.goals.map(goal => {
                  // Convert kebab-case to Title Case
                  return goal.split('-')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                }).join(', ')}
              </span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="text-gold mr-2 font-bold">•</span> 
            <div>
              <span className="font-medium">Timeframe:</span>{' '}
              <span className="text-gray-300 capitalize">
                {onboardingData.timeframe.split('-').join(' ')}
              </span>
            </div>
          </li>
        </ul>
      </div>
      
      <p className="text-gray-400">
        Redirecting you to KinKong Copilot...
      </p>
      
      <div className="flex justify-center">
        <button
          onClick={() => router.push('/copilot/chat')}
          className="px-8 py-3 bg-gradient-to-r from-gold to-amber-500 text-black font-bold rounded-lg hover:scale-105 transition-all duration-300"
        >
          Start Using Copilot Now
        </button>
      </div>
    </div>
  );
};

export default CompleteStep;
