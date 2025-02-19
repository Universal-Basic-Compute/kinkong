/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['localhost', 'vercel.app'],
  },
  async rewrites() {
    return [
      {
        source: '/api/airtable/:table',
        destination: '/api/airtable/:table/',
      },
    ];
  },
};

module.exports = nextConfig;
