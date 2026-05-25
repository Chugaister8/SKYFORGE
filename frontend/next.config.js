/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Cesium static assets
  transpilePackages: [],

  // Expose env vars to client
  env: {
    NEXT_PUBLIC_CESIUM_TOKEN: process.env.NEXT_PUBLIC_CESIUM_TOKEN ?? "",
  },

  // Webpack: handle Cesium worker files
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false, path: false, url: false,
      };
    }
    return config;
  },

  // Rewrites: proxy /api to backend (avoids CORS in dev)
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
