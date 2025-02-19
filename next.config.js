/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['localhost', 'vercel.app'],
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
