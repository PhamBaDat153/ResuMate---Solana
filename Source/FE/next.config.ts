import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const feRoot = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // Prevent Turbopack from treating the monorepo root as workspace
  // (stray package-lock.json above Source/FE previously caused OOM).
  turbopack: {
    root: feRoot,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.giphy.com',
      },
    ],
  },
}

export default nextConfig
