/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        crypto: false,
        net: false,
        tls: false
      };
    }
    
    // Handle rpc-websockets externally
    if (isServer) {
      config.externals = [...(config.externals || []), 'rpc-websockets'];
    }

    return config;
  },
  // Add transpilePackages to handle ESM modules
  transpilePackages: ['@solana/web3.js']
};

module.exports = nextConfig;
