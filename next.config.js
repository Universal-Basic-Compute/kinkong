/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'dd.dexscreener.com',
      }
    ],
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

module.exports = nextConfig;
