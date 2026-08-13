import type { NextConfig } from "next";

const API_BACKEND = process.env.API_BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  transpilePackages: ["@parallax/shared", "@parallax/types", "@parallax/graphql"],
  images: { unoptimized: true },
  output: "standalone",
  // Proxy API requests to avoid cross-origin cookie blocking
  async rewrites() {
    return [
      {
        source: "/graphql",
        destination: `${API_BACKEND}/graphql`,
      },
      {
        source: "/auth/:path*",
        destination: `${API_BACKEND}/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
