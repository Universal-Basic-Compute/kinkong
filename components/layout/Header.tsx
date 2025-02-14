'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Invest', href: '/invest' },
    { label: 'Performance', href: '/performance' },
    { label: 'Signals', href: '/signals' },
    { label: 'Strategy', href: '/strategy' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 border-b border-gold/20 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between p-4">
          <Link 
            href="/" 
            className="text-gold font-bold text-2xl tracking-tight hover:text-gold/80 transition-colors"
          >
            KinKong
          </Link>

          <nav className="hidden md:flex items-center space-x-12">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-gray-300 hover:text-gold transition-colors duration-200 font-medium tracking-wide px-2 py-1"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-8">
            <Link
              href="/invest"
              className="hidden md:block px-6 py-2 bg-gradient-to-r from-darkred to-gold text-black font-semibold rounded-lg hover:scale-105 transition-all duration-200 shadow-lg shadow-gold/10"
            >
              Start Trading
            </Link>

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
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-gray-300 hover:text-gold py-2 transition-colors duration-200 font-medium tracking-wide"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/invest"
                className="text-black py-2 px-4 bg-gradient-to-r from-darkred to-gold font-semibold rounded-lg hover:scale-105 transition-all duration-200 shadow-lg shadow-gold/10 text-center"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Start Trading
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
