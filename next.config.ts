import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Vercel handles output automatically — no standalone build needed.
  // TypeScript and ESLint errors are surfaced during build so issues
  // are caught before deployment.

  // Allow the sandbox preview iframe origin to fetch /_next/* dev assets.
  // Without this, Next.js 16 blocks cross-origin requests from the preview
  // domain and the browser throws ChunkLoadError on HMR chunk invalidation.
  allowedDevOrigins: [
    "*.space-z.ai",
    "*.vercel.app",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
