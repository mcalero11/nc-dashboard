import { resolve } from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@nc-dashboard/shared'],
  turbopack: {
    root: resolve(__dirname, '../..'),
  },
};

export default nextConfig;
