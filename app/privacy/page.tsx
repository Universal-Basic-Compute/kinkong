export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gold mb-8">Privacy Policy</h1>
      
      <div className="prose prose-invert prose-gold max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">1. Information We Collect</h2>
          <h3 className="text-xl font-semibold mb-3">1.1 Automatically Collected Information</h3>
          <p>
            When you use KinKong, we automatically collect:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Public wallet addresses used to interact with our service</li>
            <li>Transaction history related to our smart contracts</li>
            <li>Basic device information (browser type, operating system)</li>
            <li>Usage data and interaction with our interface</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">1.2 Information You Provide</h3>
          <p>
            You may choose to provide:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Email address for notifications (optional)</li>
            <li>Telegram handle for community participation</li>
            <li>Trading preferences and settings</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">2. How We Use Your Information</h2>
          <p>
            We use collected information to:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Provide and improve our trading services</li>
            <li>Process your transactions</li>
            <li>Send you important updates about the service</li>
            <li>Analyze and optimize platform performance</li>
            <li>Comply with legal obligations</li>
            <li>Prevent fraudulent or unauthorized activity</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">3. Information Sharing</h2>
          <p>
            We do not sell your personal information. We may share information:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>With service providers who assist in our operations</li>
            <li>When required by law or legal process</li>
            <li>To protect our rights or property</li>
            <li>In connection with a business transfer or acquisition</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">4. Blockchain Data</h2>
          <p>
            Please note that blockchain technology is inherently transparent:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>All transactions are publicly visible on the Solana blockchain</li>
            <li>Wallet addresses and transaction details are public information</li>
            <li>We cannot modify or delete blockchain data</li>
            <li>Consider this when interacting with our service</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">5. Data Security</h2>
          <p>
            We implement reasonable security measures to protect your information:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Encryption of sensitive data</li>
            <li>Regular security assessments</li>
            <li>Access controls and monitoring</li>
            <li>Secure infrastructure and protocols</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">6. Your Rights</h2>
          <p>
            You have the right to:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Access your personal information</li>
            <li>Request deletion of your data (where possible)</li>
            <li>Opt-out of communications</li>
            <li>Update your preferences</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">7. Cookies and Tracking</h2>
          <p>
            We use essential cookies and similar technologies to:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Maintain your session and preferences</li>
            <li>Ensure platform security</li>
            <li>Analyze platform performance</li>
            <li>Improve user experience</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">8. Children's Privacy</h2>
          <p>
            Our service is not intended for users under 18 years of age. We do not knowingly collect information from children under 18. If you believe we have collected information from a child under 18, please contact us.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">9. Changes to Privacy Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last Updated" date.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gold mb-4">10. Contact Us</h2>
          <p>
            For questions about this privacy policy or our data practices:
          </p>
          <ul className="list-disc pl-6 mt-2">
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
