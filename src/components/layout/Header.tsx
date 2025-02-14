import Link from 'next/link';

export default function Header() {
  const navItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Invest', href: '/invest' },
    { label: 'Performance', href: '/performance' },
    { label: 'Signals', href: '/signals' },
    { label: 'Strategy', href: '/strategy' },
  ];

  return (
    <header className="fixed w-full bg-black/95 backdrop-blur-sm border-b border-gold/10 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link 
            href="/" 
            className="text-gold font-bold text-xl hover:text-gold/80 transition-colors"
          >
            KinKong
          </Link>

          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-gray-300 hover-text-gold transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
            <Link
              href="/invest"
              className="hidden md:inline-block px-4 py-2 bg-gradient-to-r from-darkred/90 to-gold/90 text-black font-semibold rounded hover-effect transition-all text-sm"
            >
              Start Trading
            </Link>
            
            {/* Mobile menu button */}
            <button className="md:hidden text-gray-300 hover:text-gold">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu (hidden by default) */}
      <div className="md-hidden">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-gray-300 hover:text-gold block px-3 py-2 text-base"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
