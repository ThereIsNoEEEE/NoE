import type { NextConfig } from "next";

// Rewrites are compiled at build time; the Docker build passes BACKEND_URL (see Dockerfile).
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  turbopack: { root: process.cwd() },
  async rewrites() {
    return {
      // External rewrites also proxy WebSocket upgrades (header bell live notice feed).
      beforeFiles: [{ source: "/ws/notices", destination: `${BACKEND_URL}/ws/notices` }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
