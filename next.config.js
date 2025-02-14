/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        os: false,
        path: false,
        crypto: false
      };
    }
    return config;
  },
  transpilePackages: ['@solana/web3.js'],
  images: {
    domains: ['localhost', 'vercel.app'],
  }
};

module.exports = nextConfig;
