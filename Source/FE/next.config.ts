import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.giphy.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.VITE_BACKEND_URL ?? 'http://localhost:8080'}/:path*`,
      },
    ]
  },
}

export default nextConfig
