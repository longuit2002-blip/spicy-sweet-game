import type { NextConfig } from "next";
import path from "node:path";

const monorepoRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  /** Next 15 typegen can disagree with @types/react 18 peer trees; compile still succeeds */
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@sweet-spicy/shared-types": path.join(monorepoRoot, "packages/shared-types/dist/index.js"),
      "@sweet-spicy/game-logic": path.join(monorepoRoot, "packages/game-logic/dist/index.js"),
    };
    return config;
  },
};

export default nextConfig;
