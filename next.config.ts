import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Emits .next/standalone with only the traced runtime files, so the Docker
  // image can ship a minimal server instead of the full node_modules tree.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
