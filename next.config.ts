import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Vercel handles output automatically — no standalone build needed.
  // TypeScript and ESLint errors are surfaced during build so issues
  // are caught before deployment.
};

export default nextConfig;
