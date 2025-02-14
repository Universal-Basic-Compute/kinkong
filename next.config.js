/** @type {import('next').NextConfig} */
const nextConfig = {
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
  transpilePackages: ['@solana/web3.js']
};

module.exports = nextConfig;
