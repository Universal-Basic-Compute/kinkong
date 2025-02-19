import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KinKong Copilot | SwarmTrade',
  description: 'AI-powered trading assistant for Solana DeFi'
};

export default function CopilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900">
      {children}
    </div>
  );
}
