/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['localhost', 'vercel.app'],
  },
  env: {
    NEXT_PUBLIC_HELIUS_RPC_URL: process.env.NEXT_PUBLIC_HELIUS_RPC_URL,
    NEXT_PUBLIC_SUBSCRIPTION_WALLET: process.env.NEXT_PUBLIC_SUBSCRIPTION_WALLET
  },
  async rewrites() {
    return [
      {
        source: '/api/airtable/:table*',
        destination: '/api/airtable/:table*',
      },
      {
        source: '/api/copilot',
        destination: '/api/copilot',
      },
    ];
  },
};

export default nextConfig;
