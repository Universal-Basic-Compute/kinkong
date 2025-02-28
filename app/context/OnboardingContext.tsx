'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// Define the onboarding steps
export enum OnboardingStep {
  WELCOME = 'welcome',
  EXPERIENCE = 'experience',
  INTERESTS = 'interests',
  INCOME_SOURCE = 'income_source',
  RISK_TOLERANCE = 'risk_tolerance',
  COMPLETE = 'complete'
}

// Define the onboarding data structure
export interface OnboardingData {
  experience: string;
  interests: string[];
  incomeSource: string;
  riskTolerance: string;
  completed: boolean;
}

// Default onboarding data
const defaultOnboardingData: OnboardingData = {
  experience: '',
  interests: [],
  incomeSource: '',
  riskTolerance: '',
  completed: false
};

// Context interface
interface OnboardingContextType {
  currentStep: OnboardingStep;
  onboardingData: OnboardingData;
  setCurrentStep: (step: OnboardingStep) => void;
  updateOnboardingData: (data: Partial<OnboardingData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  isCompleted: boolean;
  saveUserData: (walletAddress?: string) => Promise<boolean>; // Add this line
}

// Create the context
const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

// Step order for navigation
const stepOrder: OnboardingStep[] = [
  OnboardingStep.WELCOME,
  OnboardingStep.EXPERIENCE,
  OnboardingStep.INTERESTS,
  OnboardingStep.INCOME_SOURCE,
  OnboardingStep.RISK_TOLERANCE,
  OnboardingStep.COMPLETE
];

// Provider component
export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(OnboardingStep.WELCOME);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>(defaultOnboardingData);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Load saved onboarding data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('onboardingData');
    const savedStep = localStorage.getItem('onboardingStep');
    const completionStatus = localStorage.getItem('onboardingCompleted');
    
    if (savedData) {
      setOnboardingData(JSON.parse(savedData));
    }
    
    if (savedStep && Object.values(OnboardingStep).includes(savedStep as OnboardingStep)) {
      setCurrentStep(savedStep as OnboardingStep);
    }
    
    if (completionStatus === 'true') {
      setIsCompleted(true);
    }
  }, []);

  // Save onboarding data to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('onboardingData', JSON.stringify(onboardingData));
    localStorage.setItem('onboardingStep', currentStep);
    localStorage.setItem('onboardingCompleted', isCompleted.toString());
  }, [onboardingData, currentStep, isCompleted]);

  // Update onboarding data
  const updateOnboardingData = (data: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...data }));
  };

  // Navigate to next step
  const nextStep = () => {
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
    
    // If moving to complete step, mark as completed
    if (stepOrder[currentIndex + 1] === OnboardingStep.COMPLETE) {
      setIsCompleted(true);
      updateOnboardingData({ completed: true });
    }
  };

  // Navigate to previous step
  const prevStep = () => {
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  // Save user data to backend
  const saveUserData = async (walletAddress?: string): Promise<boolean> => {
    try {
      console.log('Starting saveUserData function with wallet:', walletAddress);
      console.log('Onboarding data to save:', onboardingData);
      
      const payload = {
        wallet: walletAddress || null,
        experience: onboardingData.experience,
        interests: onboardingData.interests,
        incomeSource: onboardingData.incomeSource,
        riskTolerance: onboardingData.riskTolerance,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString()
      };
      
      console.log('Sending payload to API:', payload);
      console.log('API endpoint: /api/users/create');
      
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('API response status:', response.status);
      const responseData = await response.json();
      console.log('API response data:', responseData);

      if (!response.ok) {
        console.error('API error:', responseData);
        throw new Error('Failed to save user data');
      }

      // Save to local storage as backup
      localStorage.setItem('onboardingData', JSON.stringify(onboardingData));
      localStorage.setItem('onboardingCompleted', 'true');
      
      console.log('User data saved successfully');
      return true;
    } catch (error) {
      console.error('Error in saveUserData function:', error);
      return false;
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        onboardingData,
        setCurrentStep,
        updateOnboardingData,
        nextStep,
        prevStep,
        isCompleted,
        saveUserData
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

// Custom hook to use the onboarding context
export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
