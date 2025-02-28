'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboarding } from '@/app/context/OnboardingContext';
import { useWallet } from '@solana/wallet-adapter-react';

const CompleteStep: React.FC = () => {
  const { onboardingData, saveUserData } = useOnboarding();
  const router = useRouter();
  const { publicKey } = useWallet();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Save onboarding data to backend
  useEffect(() => {
    const saveOnboardingData = async () => {
      try {
        setIsSaving(true);
        // Save data to Airtable USERS table
        console.log('Saving onboarding data:', onboardingData);
        
        const walletAddress = publicKey ? publicKey.toString() : undefined;
        const success = await saveUserData(walletAddress);
        
        if (!success) {
          setSaveError('Failed to save your preferences. You can still continue, but your settings might not be saved.');
        }
      } catch (error) {
        console.error('Error saving onboarding data:', error);
        setSaveError('An error occurred while saving your preferences.');
      } finally {
        setIsSaving(false);
      }
    };

    saveOnboardingData();
  }, [onboardingData, publicKey, saveUserData]);

  // Add automatic redirection after saving is complete
  useEffect(() => {
    // Check if saving is complete and there are no errors
    if (!isSaving && saveError === null) {
      // Add a short delay before redirecting to ensure data is saved
      const redirectTimer = setTimeout(() => {
        router.push('/copilot/chat');
      }, 1500);
      
      return () => clearTimeout(redirectTimer);
    }
  }, [isSaving, saveError, router]);

  // Add a direct call to saveUserData when the button is clicked
  const handleSaveData = async () => {
    console.log('Manual save triggered');
    setIsSaving(true);
    const walletAddress = publicKey ? publicKey.toString() : undefined;
    const success = await saveUserData(walletAddress);
    console.log('Manual save result:', success);
    setIsSaving(false);
    if (success) {
      router.push('/copilot/chat');
    }
  };

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
        
      {saveError && (
        <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-sm">
          {saveError}
        </div>
      )}
      
      <p className="text-gray-400">
        {isSaving ? 'Saving your preferences...' : 'Redirecting you to KinKong Copilot...'}
      </p>
      
      <div className="flex justify-center">
        <button
          onClick={handleSaveData}
          disabled={isSaving}
          className={`px-8 py-3 bg-gradient-to-r from-gold to-amber-500 text-black font-bold rounded-lg 
            ${isSaving ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105 transition-all duration-300'}`}
        >
          {isSaving ? 'Saving...' : 'Start Using Copilot Now'}
        </button>
      </div>
    </div>
  );
};

export default CompleteStep;
