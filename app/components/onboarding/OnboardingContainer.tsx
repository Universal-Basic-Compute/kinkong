'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboarding, OnboardingStep } from '@/app/context/OnboardingContext';
import WelcomeStep from './steps/WelcomeStep';
import ExperienceStep from './steps/ExperienceStep';
import InterestsStep from './steps/InterestsStep';
import GoalsStep from './steps/GoalsStep';
import TimeframeStep from './steps/TimeframeStep';
import CompleteStep from './steps/CompleteStep';
import OnboardingProgress from './OnboardingProgress';

const OnboardingContainer: React.FC = () => {
  const { currentStep, isCompleted } = useOnboarding();
  const router = useRouter();

  // Redirect to copilot chat if onboarding is completed
  useEffect(() => {
    if (isCompleted && currentStep === OnboardingStep.COMPLETE) {
      // Add a small delay before redirecting to ensure data is saved
      const redirectTimer = setTimeout(() => {
        router.push('/copilot/chat');
      }, 3000);
      
      return () => clearTimeout(redirectTimer);
    }
  }, [isCompleted, currentStep, router]);

  // Render the current step
  const renderStep = () => {
    switch (currentStep) {
      case OnboardingStep.WELCOME:
        return <WelcomeStep />;
      case OnboardingStep.EXPERIENCE:
        return <ExperienceStep />;
      case OnboardingStep.INTERESTS:
        return <InterestsStep />;
      case OnboardingStep.GOALS:
        return <GoalsStep />;
      case OnboardingStep.TIMEFRAME:
        return <TimeframeStep />;
      case OnboardingStep.COMPLETE:
        return <CompleteStep />;
      default:
        return <WelcomeStep />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-black/30 border border-gold/20 rounded-lg p-6 md:p-8">
        {/* Progress indicator */}
        {currentStep !== OnboardingStep.WELCOME && currentStep !== OnboardingStep.COMPLETE && (
          <OnboardingProgress />
        )}
        
        {/* Step content */}
        <div className="mt-4">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default OnboardingContainer;
