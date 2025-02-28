'use client';

import Link from 'next/link';
import { useState } from 'react';
import { WalletConnect } from '@/components/wallet/WalletConnect';

type SubItem = {
  label: string;
  href: string;
  description: string;
  isGlowing?: boolean;
  emoji?: string; // Add emoji property
};

type BaseNavItem = {
  label: string;
  subItems: SubItem[];
};

type GroupNavItem = BaseNavItem & {
  isGroup: true;
  byLine?: string;
  isDisabled?: boolean;
};

type LinkNavItem = BaseNavItem & {
  isGroup: false;
  href: string;
  isGlowing?: boolean;
  customClass?: string;
};

type NavItem = GroupNavItem | LinkNavItem;

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    { 
      label: 'Kong Invest',
      isGroup: true,
      subItems: [
        { 
          label: 'Tokens', 
          href: '/tokens',
          description: 'Tracked tokens and metrics',
          emoji: '🪙'
        },
        { 
          label: 'Portfolio', 
          href: '/portfolio',
          description: 'Portfolio dashboard and analytics',
          emoji: '📊'
        },
        { 
          label: 'Signals', 
          href: '/signals',
          description: 'Trading signals and setups',
          emoji: '📡'
        },
        { 
          label: 'Trades', 
          href: '/trades',
          description: 'Trade history and execution',
          emoji: '🔄'
        },
        { 
          label: 'Performance', 
          href: '/performance',
          description: 'Trading history and analytics',
          emoji: '📈'
        },
        { 
          label: 'Strategy', 
          href: '/strategy',
          description: 'Portfolio strategy and settings',
          emoji: '⚙️'
        },
        { 
          label: 'Invest', 
          href: '/invest',
          description: 'Investment opportunities and allocation',
          emoji: '💰',
          isGlowing: true
        }
      ]
    },
    {
      label: 'Kong Copilot',
      isGroup: false,
      href: '/copilot',
      subItems: [],
      isGlowing: false,
      customClass: ''
    },
    {
      label: 'Get Started',
      isGroup: false,
      href: '/copilot/start',
      subItems: [],
      isGlowing: true,
      customClass: 'text-gold animate-pulse'
    }
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 border-b border-gold/20 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between p-4">
          <Link 
            href="/" 
            className="electric-title text-2xl tracking-tight flex flex-col items-start"
          >
            <span>Kong</span>
            <span className="text-xs -mt-1 self-end">INVEST</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            {navItems.map((item: NavItem) => (
              <div key={item.label} className="relative group">
                {item.isGroup ? (
                  <div className={`flex flex-col justify-center -mt-1 ${item.isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <div className={`text-gray-300 cursor-default px-2 py-1 flex items-center font-medium tracking-wide ${
                      item.isDisabled ? 'text-gray-500' : ''
                    }`}>
                      {item.label}
                      <svg 
                        className={`w-4 h-4 ml-1 transform group-hover:rotate-180 transition-transform duration-200 ${
                          item.isDisabled ? 'opacity-50' : ''
                        }`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className={`text-gray-300 hover:text-gold transition-colors duration-200 font-medium tracking-wide px-2 py-1 flex items-center
                      ${item.isGlowing ? 'electric-title' : ''}
                      ${item.customClass || ''}`}
                  >
                    {item.label}
                    {item.subItems.length > 0 && (
                      <svg 
                        className="w-4 h-4 ml-1 transform group-hover:rotate-180 transition-transform duration-200" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </Link>
                )}
                
                {item.subItems && (
                  <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-black/95 border border-gold/20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-1">
                      {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className="block px-4 py-2 text-sm text-gray-300 hover:text-gold hover:bg-white/5"
                        >
                          {subItem.emoji && <span className="mr-2">{subItem.emoji}</span>}
                          {subItem.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="flex items-center space-x-8">
            <div className="hidden md:block">
              <WalletConnect />
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-300 hover:text-gold transition-colors duration-200 md:hidden"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="border-t border-gold/20 bg-black/95 backdrop-blur-sm md:hidden">
            <nav className="p-4 flex flex-col space-y-2">
              {navItems.map((item: NavItem) => (
                <div key={item.label}>
                  {item.isGroup ? (
                    <>
                      <div>
                        <div className="text-gray-300 py-2 font-medium tracking-wide">
                          {item.label}
                        </div>
                      </div>
                      <div className="pl-4 flex flex-col space-y-2">
                        {item.subItems.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className="text-gray-400 hover:text-gold py-1 transition-colors duration-200"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            {subItem.emoji && <span className="mr-2">{subItem.emoji}</span>}
                            {subItem.label}
                          </Link>
                        ))}
                      </div>
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      className="text-gray-300 hover:text-gold py-2 transition-colors duration-200 font-medium tracking-wide"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
              <div className="pt-2">
                <WalletConnect />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
