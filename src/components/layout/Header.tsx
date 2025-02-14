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
    <header style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      borderBottom: '1px solid rgba(255, 215, 0, 0.2)'
    }}>
      <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem'
        }}>
          <Link 
            href="/" 
            style={{
              color: '#FFD700',
              fontWeight: 'bold',
              fontSize: '1.5rem'
            }}
          >
            KinKong
          </Link>

          <nav style={{
            display: 'none',
            gap: '2rem',
            '@media (min-width: 768px)': {
              display: 'flex'
            }
          }}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  color: '#D1D5DB',
                  transition: 'color 0.2s',
                  ':hover': {
                    color: '#FFD700'
                  }
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              href="/invest"
              style={{
                display: 'none',
                '@media (min-width: 768px)': {
                  display: 'block'
                },
                padding: '0.5rem 1rem',
                background: 'linear-gradient(to right, #8B0000, #FFD700)',
                color: 'black',
                fontWeight: 600,
                borderRadius: '0.375rem'
              }}
            >
              Start Trading
            </Link>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{
                color: '#D1D5DB',
                '@media (min-width: 768px)': {
                  display: 'none'
                }
              }}
            >
              <svg
                style={{
                  width: '1.5rem',
                  height: '1.5rem'
                }}
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
          <div style={{
            borderTop: '1px solid rgba(255, 215, 0, 0.2)',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            '@media (min-width: 768px)': {
              display: 'none'
            }
          }}>
            <nav style={{ padding: '0.5rem 1rem' }}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'block',
                    color: '#D1D5DB',
                    padding: '0.5rem 0',
                    ':hover': {
                      color: '#FFD700'
                    }
                  }}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/invest"
                style={{
                  display: 'block',
                  color: '#FFD700',
                  padding: '0.5rem 0'
                }}
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
