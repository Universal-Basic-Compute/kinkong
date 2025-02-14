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
  transpilePackages: ['@solana/web3.js'],
  generateBuildId: () => 'build',
  experimental: {
    outputFileTracingRoot: undefined
  },
  async rewrites() {
    return [
      {
        source: '/:path*',
        destination: '/:path*'
      }
    ];
  }
};

module.exports = nextConfig;
