'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboarding, OnboardingStep } from '@/app/context/OnboardingContext';
import WelcomeStep from './steps/WelcomeStep';
import ExperienceStep from './steps/ExperienceStep';
import InterestsStep from './steps/InterestsStep';
import IncomeSourceStep from './steps/IncomeSourceStep';
import RiskToleranceStep from './steps/RiskToleranceStep';
import CompleteStep from './steps/CompleteStep';
import OnboardingProgress from './OnboardingProgress';

const OnboardingContainer: React.FC = () => {
  const { currentStep, isCompleted } = useOnboarding();
  const router = useRouter();

  // Log onboarding state but don't automatically redirect
  useEffect(() => {
    // Don't automatically redirect - let the user click the button in CompleteStep
    console.log('Current step:', currentStep, 'isCompleted:', isCompleted);
  }, [isCompleted, currentStep]);

  // Render the current step
  const renderStep = () => {
    switch (currentStep) {
      case OnboardingStep.WELCOME:
        return <WelcomeStep />;
      case OnboardingStep.EXPERIENCE:
        return <ExperienceStep />;
      case OnboardingStep.INTERESTS:
        return <InterestsStep />;
      case OnboardingStep.INCOME_SOURCE:
        return <IncomeSourceStep />;
      case OnboardingStep.RISK_TOLERANCE:
        return <RiskToleranceStep />;
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
