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
        stream: false,
        http: false,
        https: false,
        zlib: false,
        net: false,
        tls: false,
        'rpc-websockets': require.resolve('rpc-websockets'),
        'websocket': require.resolve('websocket').replace('index.js', 'lib/websocket.js')
      };
    }
    return config;
  },
};

module.exports = nextConfig;
