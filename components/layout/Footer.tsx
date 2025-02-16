export default function Footer() {
  return (
    <footer className="bg-black/95 border-t border-gold/20 py-8 mt-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-gold font-bold text-lg mb-4">About KinKong</h3>
            <p className="text-gray-400 text-sm">
              24/7 Superhuman Trading Intelligence for Solana AI Tokens
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-gold font-bold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><a href="/dashboard" className="text-gray-400 hover:text-gold text-sm">Dashboard</a></li>
              <li><a href="/invest" className="text-gray-400 hover:text-gold text-sm">Invest</a></li>
              <li><a href="/performance" className="text-gray-400 hover:text-gold text-sm">Performance</a></li>
              <li><a href="/signals" className="text-gray-400 hover:text-gold text-sm">Signals</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-gold font-bold text-lg mb-4">Resources</h3>
            <ul className="space-y-2">
              <li><a href="/strategy" className="text-gray-400 hover:text-gold text-sm">Strategy</a></li>
              <li><a href="https://twitter.com/kinkong_ai" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gold text-sm">Twitter</a></li>
              <li><a href="https://discord.gg/kinkong" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gold text-sm">Discord</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-gold font-bold text-lg mb-4">Legal</h3>
            <ul className="space-y-2">
              <li><a href="/terms" className="text-gray-400 hover:text-gold text-sm">Terms of Service</a></li>
              <li><a href="/privacy" className="text-gray-400 hover:text-gold text-sm">Privacy Policy</a></li>
              <li><a href="/disclaimer" className="text-gray-400 hover:text-gold text-sm">Risk Disclaimer</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gold/20 mt-8 pt-8 text-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} KinKong AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
