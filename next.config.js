/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tcg-tradein-images.s3.eu-west-2.amazonaws.com',
        pathname: '/card-images/**',
      },
      {
        protocol: 'https',
        hostname: 'optcgapi.com',
        pathname: '/**',
      },
    ],
  },

  // Headers for CORS and caching
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      allowedOrigins: ['app.cambridgetcg.com', 'localhost:3000'],
    },
  },
};

module.exports = nextConfig;
