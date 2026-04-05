import type { NextConfig } from "next";
import path from "node:path";

const monorepoRoot = path.resolve(process.cwd(), "../..");
const sharedTypesDist = path.join(monorepoRoot, "packages/shared-types/dist/index.js");
const gameLogicDist = path.join(monorepoRoot, "packages/game-logic/dist/index.js");

/**
 * REST under `/api/*` is proxied by `app/api/[[...path]]/route.ts` (runtime `API_INTERNAL_ORIGIN`).
 * Here we only rewrite Socket.IO (WebSocket upgrade); use host Nginx if you prefer.
 */
function socketIoProxyRewrites():
  | []
  | { beforeFiles: { source: string; destination: string }[] } {
  const origin = process.env.API_PROXY_ORIGIN?.trim();
  if (!origin) {
    return [];
  }
  const base = origin.replace(/\/$/, "");
  return {
    beforeFiles: [{ source: "/socket.io/:path*", destination: `${base}/socket.io/:path*` }],
  };
}

const nextConfig: NextConfig = {
  /** Allow card-art `quality` values on `next/image` (see `GAME_CARD_NEXT_IMAGE_QUALITY` in `game-card-assets.ts`). */
  images: {
    qualities: [75, 85, 88, 92],
  },
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
  async rewrites() {
    return socketIoProxyRewrites();
  },
};

export default nextConfig;
