import type { NextConfig } from "next";
import path from "node:path";

const monorepoRoot = path.resolve(process.cwd(), "../..");
const sharedTypesDist = path.join(monorepoRoot, "packages/shared-types/dist/index.js");
const gameLogicDist = path.join(monorepoRoot, "packages/game-logic/dist/index.js");

const nextConfig: NextConfig = {
  output: "standalone",
  /** Trace workspace packages into the standalone server bundle (monorepo Docker / deploy). */
  outputFileTracingRoot: monorepoRoot,
  /** Relax typecheck until generated routes and third-party types fully match React 19 / Next 16 */
  typescript: {
    ignoreBuildErrors: true,
  },
  /** Next.js 16 uses Turbopack by default; keep the same aliases as webpack for `next dev` / `next build` */
  turbopack: {
    resolveAlias: {
      "@sweet-spicy/shared-types": sharedTypesDist,
      "@sweet-spicy/game-logic": gameLogicDist,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@sweet-spicy/shared-types": sharedTypesDist,
      "@sweet-spicy/game-logic": gameLogicDist,
    };
    return config;
  },
};

export default nextConfig;
