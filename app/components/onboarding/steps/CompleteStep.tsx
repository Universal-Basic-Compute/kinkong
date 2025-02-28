'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboarding } from '@/app/context/OnboardingContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnect } from '@/components/wallet/WalletConnect';

const CompleteStep: React.FC = () => {
  const { onboardingData, saveUserData } = useOnboarding();
  const router = useRouter();
  const { publicKey } = useWallet();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Save onboarding data to backend - only when wallet is connected
  useEffect(() => {
    if (publicKey) {
      const saveOnboardingData = async () => {
        try {
          console.log('Auto-save triggered in useEffect');
          setIsSaving(true);
          setSaveError(null);
          
          // Save data to Airtable USERS table
          console.log('Saving onboarding data:', onboardingData);
          
          const walletAddress = publicKey.toString();
          console.log('Using wallet address for auto-save:', walletAddress);
          
          const success = await saveUserData(walletAddress);
          console.log('Auto-save result:', success);
          
          if (!success) {
            setSaveError('Failed to save your preferences. Please try again.');
          }
        } catch (error) {
          console.error('Error in auto-save:', error);
          setSaveError('An error occurred while saving your preferences.');
        } finally {
          setIsSaving(false);
        }
      };

      saveOnboardingData();
    }
  }, [onboardingData, publicKey, saveUserData]);

  // No automatic redirection - let the user click the button

  // Add a direct call to saveUserData when the button is clicked
  const handleSaveData = async () => {
    if (!publicKey) {
      setSaveError('Please connect your wallet to continue.');
      return;
    }
    
    console.log('Manual save triggered - button clicked');
    setIsSaving(true);
    setSaveError(null); // Reset any previous errors
    
    // Check if required fields are present
    if (!onboardingData.experience || !onboardingData.interests || onboardingData.interests.length === 0) {
      setSaveError('Please complete all required fields before continuing.');
      setIsSaving(false);
      return;
    }
    
    const walletAddress = publicKey.toString();
    console.log('Using wallet address:', walletAddress);
    
    try {
      const success = await saveUserData(walletAddress);
      console.log('Manual save result:', success);
      
      if (!success) {
        setSaveError('Failed to save your preferences. Please try again.');
      } else {
        // If successful, redirect to chat
        router.push('/copilot/chat?code=default');
      }
    } catch (error) {
      console.error('Error in manual save:', error);
      setSaveError('An error occurred while saving your preferences.');
    } finally {
      setIsSaving(false);
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
              <span className="font-medium">Income Source:</span>{' '}
              <span className="text-gray-300 capitalize">
                {onboardingData.incomeSource.split('-').join(' ')}
              </span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="text-gold mr-2 font-bold">•</span> 
            <div>
              <span className="font-medium">Risk Tolerance:</span>{' '}
              <span className="text-gray-300 capitalize">
                {onboardingData.riskTolerance.split('-').join(' ')}
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
        {isSaving ? 'Saving your preferences...' : 'Ready to start using Kong Copilot!'}
      </p>
      
      {!publicKey && (
        <div className="mb-6">
          <WalletConnect />
        </div>
      )}
      
      <div className="flex justify-center">
        <button
          onClick={handleSaveData}
          disabled={isSaving || !publicKey}
          className={`px-8 py-3 bg-gradient-to-r from-gold to-amber-500 text-black font-bold rounded-lg 
            ${(isSaving || !publicKey) ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105 transition-all duration-300 shadow-lg shadow-gold/20'}`}
          title={!publicKey ? "Connect your wallet to continue" : ""}
        >
          {isSaving ? 'Saving...' : 'Start Using Copilot Now'}
        </button>
      </div>
    </div>
  );
};

export default CompleteStep;
