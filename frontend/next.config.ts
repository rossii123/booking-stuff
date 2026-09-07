import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Self-contained build (server.js + minimal node_modules) for the Docker image.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
