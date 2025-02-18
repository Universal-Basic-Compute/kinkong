export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gold mb-8">Terms of Service</h1>
      
      <div className="prose prose-invert prose-gold max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">1. Introduction</h2>
          <p>
            Welcome to KinKong. By using our service, you agree to these terms. Please read them carefully.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">2. Risk Disclosure</h2>
          <p>
            Trading cryptocurrencies involves substantial risk of loss and is not suitable for all investors. You should carefully consider whether trading is suitable for you in light of your circumstances, knowledge, and financial resources.
          </p>
          <ul className="list-disc pl-6 mt-4">
            <li>Past performance is not indicative of future results</li>
            <li>Cryptocurrency markets are highly volatile</li>
            <li>You may lose more than your initial investment</li>
            <li>Technical issues may affect trading execution</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">3. Service Description</h2>
          <p>
            KinKong provides automated cryptocurrency trading services on the Solana blockchain. Our service includes:
          </p>
          <ul className="list-disc pl-6 mt-4">
            <li>Automated trading signals</li>
            <li>Portfolio management</li>
            <li>Market analysis</li>
            <li>Performance tracking</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">4. User Responsibilities</h2>
          <p>
            Users are responsible for:
          </p>
          <ul className="list-disc pl-6 mt-4">
            <li>Maintaining the security of their wallet and private keys</li>
            <li>Understanding the risks involved in cryptocurrency trading</li>
            <li>Complying with all applicable laws and regulations</li>
            <li>Providing accurate information when using our services</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">5. Limitations of Liability</h2>
          <p>
            KinKong and its affiliates shall not be liable for:
          </p>
          <ul className="list-disc pl-6 mt-4">
            <li>Trading losses or missed opportunities</li>
            <li>Technical issues or service interruptions</li>
            <li>Delays in trade execution</li>
            <li>Market conditions or price movements</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">6. Modifications to Service</h2>
          <p>
            We reserve the right to modify or discontinue our service at any time, with or without notice. We may also update these terms from time to time. Continued use of the service after any changes constitutes acceptance of the new terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">7. Contact Information</h2>
          <p>
            For questions about these terms or our service, please contact us through our official channels:
          </p>
          <ul className="list-disc pl-6 mt-4">
            <li>Telegram: @kinkong_sol</li>
            <li>Twitter: @kinkong_sol</li>
          </ul>
        </section>

        <div className="mt-12 text-sm text-gray-400">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
