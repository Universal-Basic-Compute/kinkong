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
    <header className="fixed top-0 left-0 right-0 bg-black border-b border-gold/20">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between px-4 py-4">
          {/* Logo */}
          <Link 
            href="/" 
            className="text-gold font-bold text-2xl"
          >
            KinKong
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-gray-300 hover:text-gold transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right side buttons */}
          <div className="flex items-center space-x-4">
            {/* CTA Button - Desktop only */}
            <Link
              href="/invest"
              className="hidden md:block px-4 py-2 bg-gradient-to-r from-darkred to-gold text-black font-semibold rounded hover-effect transition-all"
            >
              Start Trading
            </Link>
            
            {/* Mobile menu button */}
            <button 
              className="md:hidden text-gray-300 hover:text-gold transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <svg 
                className="h-6 w-6" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                aria-hidden="true"
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
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gold/20">
          <nav className="px-4 py-2 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block text-gray-300 hover:text-gold py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/invest"
              className="block text-gold hover:text-gold/80 py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Start Trading
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
