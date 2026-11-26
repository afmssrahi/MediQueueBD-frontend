import type { NextConfig } from "next";

/**
 * The AI summary service — a separate backend.
 *
 * The browser calls it through a same-origin path (`/ai-service/...`), and
 * Next.js proxies that to the service. Proxying rather than calling it
 * cross-origin means there is no CORS setup to do and no CORS preflight on
 * the multipart upload.
 *
 * The proxy itself lives in `src/proxy.ts`, not in a `rewrites()` entry here.
 * `next.config.ts` is evaluated at build time, so a rewrite would freeze the
 * destination into the built routes manifest — and `AI_SERVICE_URL` is a
 * run-time setting. The proxy reads it per request, so one image can be
 * pointed at a different service without being rebuilt.
 */
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
