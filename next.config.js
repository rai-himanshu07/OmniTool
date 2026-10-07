/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.OMNITOOL_DIST_DIR || '.next',
  agentRules: false,
  serverExternalPackages: ['better-sqlite3'],
  experimental: { proxyClientMaxBodySize: '110mb' },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  }
};

module.exports = nextConfig;
