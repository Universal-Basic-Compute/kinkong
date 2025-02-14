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
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-gold/20 shadow-lg">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between px-4 py-4">
          <Link 
            href="/" 
            className="text-gold font-bold text-2xl hover:text-gold/80 transition-colors"
          >
            KinKong
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-gray-300 hover:text-gold transition-colors relative group"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gold transition-all duration-300 group-hover:w-full"/>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/invest"
              className="hidden md:block px-4 py-2 bg-gradient-to-r from-darkred to-gold text-black font-semibold rounded-md hover:shadow-lg hover:scale-105 transition-all duration-200"
            >
              Start Trading
            </Link>

            <button
              className="md:hidden text-gray-300 hover:text-gold transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
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
          <div className="md:hidden border-t border-gold/20 bg-black/95 backdrop-blur-sm">
            <nav className="px-4 py-2 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-gray-300 hover:text-gold py-2 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/invest"
                className="block text-gold hover:text-gold/80 py-2 transition-colors"
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
