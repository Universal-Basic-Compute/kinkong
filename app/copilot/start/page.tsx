'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnect } from '@/components/wallet/WalletConnect';

export default function CopilotStartPage() {
  const { connected } = useWallet();
  const [activeStep, setActiveStep] = useState(1);

  const steps = [
    {
      title: "Download the extension files",
      content: (
        <div>
          Download the KinKong Copilot extension files{' '}
          <a 
            href="https://github.com/Universal-Basic-Compute/kinkong-copilot/archive/refs/heads/main.zip"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:text-gold/80 underline"
          >
            here
          </a>.
        </div>
      ),
      code: null
    },
    {
      title: "Extract the ZIP file",
      content: "Extract the downloaded ZIP file to a folder on your computer.",
      code: null
    },
    {
      title: "Open Chrome Extensions",
      content: (
        <div>
          Open Chrome and navigate to{' '}
          <a 
            href="chrome://extensions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:text-gold/80 underline"
          >
            chrome://extensions
          </a>
          {' '}or click on the puzzle piece icon and select 'Manage Extensions'.
        </div>
      ),
      code: null
    },
    {
      title: "Enable Developer Mode",
      content: "Toggle 'Developer mode' in the top right corner of the extensions page.",
      code: null
    },
    {
      title: "Load Unpacked Extension",
      content: "Click 'Load unpacked' and select the folder where you extracted the extension files.",
      code: null
    }
  ];

  return (
    <div className="min-h-screen pt-20 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">
            Get Started with <span className="white-glow-text">KinKong Copilot</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Follow these steps to install the developer version of KinKong Copilot while we prepare for the Chrome Web Store release.
          </p>
        </div>

        {/* Chrome Web Store Button (Disabled) */}
        <div className="bg-black/50 border border-gold/20 rounded-lg p-6 text-center">
          <button 
            disabled
            className="px-6 py-3 bg-gray-800 text-gray-400 rounded-lg cursor-not-allowed flex items-center justify-center mx-auto space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              <path d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5 5 2.24 5 5z"/>
            </svg>
            <span>Chrome Web Store (Coming Soon)</span>
          </button>
          <p className="mt-2 text-sm text-gray-500">
            Our extension is currently under review by the Chrome Web Store team
          </p>
        </div>

        {/* Installation Steps */}
        <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-6 text-gold">
            Developer Installation Guide
          </h2>
          
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div 
                key={index}
                className={`p-4 rounded-lg transition-all duration-200 ${
                  activeStep === index + 1 
                    ? 'bg-gold/10 border border-gold/20' 
                    : 'bg-black/30 hover:bg-black/40'
                }`}
                onClick={() => setActiveStep(index + 1)}
              >
                <div className="flex items-start space-x-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold 
                    ${activeStep === index + 1 
                      ? 'bg-gradient-to-br from-gold via-amber-500 to-yellow-500 text-black animate-pulse shadow-lg shadow-gold/20' 
                      : 'bg-black/30 text-gray-400 border border-gold/20'
                    } transition-all duration-300`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">{step.title}</h3>
                    <p className="text-gray-400 text-sm">
                      {step.content}
                    </p>
                    {step.code && (
                      <pre className="mt-2 p-3 bg-black/50 rounded-lg overflow-x-auto text-sm">
                        <code>{step.code}</code>
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Download Button */}
        <div className="text-center">
          <a 
            href="https://github.com/Universal-Basic-Compute/kinkong-copilot/archive/refs/heads/main.zip"
            className="inline-block px-8 py-4 bg-gold hover:bg-gold/80 text-black font-bold rounded-lg transition-colors duration-200"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download Extension Files
          </a>
          <div className="mt-2 text-sm text-gray-400">
            Or visit the{' '}
            <a 
              href="https://github.com/Universal-Basic-Compute/kinkong-copilot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold/80 underline"
            >
              GitHub repository
            </a>
          </div>
        </div>

        {/* Support Section */}
        <div className="bg-black/30 border border-gold/20 rounded-lg p-6 text-center">
          <h3 className="text-xl font-bold mb-2">Need Help?</h3>
          <p className="text-gray-400 mb-4">
            Having trouble installing the extension? Join our community for support.
          </p>
          <a 
            href="https://t.me/ubc_portal"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:text-gold/80 transition-colors duration-200"
          >
            Join Telegram Community →
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-20 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">
            Get Started with <span className="white-glow-text">KinKong Copilot</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Follow these steps to install the developer version of KinKong Copilot while we prepare for the Chrome Web Store release.
          </p>
        </div>

        {/* Chrome Web Store Button (Disabled) */}
        <div className="bg-black/50 border border-gold/20 rounded-lg p-6 text-center">
          <button 
            disabled
            className="px-6 py-3 bg-gray-800 text-gray-400 rounded-lg cursor-not-allowed flex items-center justify-center mx-auto space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              <path d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5 5 2.24 5 5z"/>
            </svg>
            <span>Chrome Web Store (Coming Soon)</span>
          </button>
          <p className="mt-2 text-sm text-gray-500">
            Our extension is currently under review by the Chrome Web Store team
          </p>
        </div>

        {/* Installation Steps */}
        <div className="bg-black/50 border border-gold/20 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-6 text-gold">
            Developer Installation Guide
          </h2>
          
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div 
                key={index}
                className={`p-4 rounded-lg transition-all duration-200 ${
                  activeStep === index + 1 
                    ? 'bg-gold/10 border border-gold/20' 
                    : 'bg-black/30 hover:bg-black/40'
                }`}
                onClick={() => setActiveStep(index + 1)}
              >
                <div className="flex items-start space-x-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold 
                    ${activeStep === index + 1 
                      ? 'bg-gradient-to-br from-gold via-amber-500 to-yellow-500 text-black animate-pulse shadow-lg shadow-gold/20' 
                      : 'bg-black/30 text-gray-400 border border-gold/20'
                    } transition-all duration-300`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">{step.title}</h3>
                    <p className="text-gray-400 text-sm">
                      {typeof step.content === 'string' 
                        ? step.content 
                        : step.content
                      }
                    </p>
                    {step.code && (
                      <pre className="mt-2 p-3 bg-black/50 rounded-lg overflow-x-auto text-sm">
                        <code>{step.code}</code>
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Download Button */}
        <div className="text-center">
          <a 
            href="https://github.com/Universal-Basic-Compute/kinkong-copilot/archive/refs/heads/main.zip"
            className="inline-block px-8 py-4 bg-gold hover:bg-gold/80 text-black font-bold rounded-lg transition-colors duration-200"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download Extension Files
          </a>
          <div className="mt-2 text-sm text-gray-400">
            Or visit the{' '}
            <a 
              href="https://github.com/Universal-Basic-Compute/kinkong-copilot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold/80 underline"
            >
              GitHub repository
            </a>
          </div>
        </div>

        {/* Support Section */}
        <div className="bg-black/30 border border-gold/20 rounded-lg p-6 text-center">
          <h3 className="text-xl font-bold mb-2">Need Help?</h3>
          <p className="text-gray-400 mb-4">
            Having trouble installing the extension? Join our community for support.
          </p>
          <a 
            href="https://t.me/ubc_portal"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:text-gold/80 transition-colors duration-200"
          >
            Join Telegram Community →
          </a>
        </div>
      </div>
    </div>
  );
}
