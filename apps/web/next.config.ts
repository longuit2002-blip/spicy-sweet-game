import type { NextConfig } from "next";
import path from "node:path";

const monorepoRoot = path.resolve(process.cwd(), "../..");
const sharedTypesDist = path.join(monorepoRoot, "packages/shared-types/dist/index.js");
const gameLogicDist = path.join(monorepoRoot, "packages/game-logic/dist/index.js");

/**
 * When set at **build** time (e.g. Docker: `API_PROXY_ORIGIN=http://api:8000`), the standalone
 * server proxies `/api/*` and `/socket.io` to Nest. Use Nginx on the host if you prefer one edge
 * proxy; this covers setups that only expose the web container (tunnel → :3000).
 */
function productionApiProxyRewrites(): { source: string; destination: string }[] {
  const origin = process.env.API_PROXY_ORIGIN?.trim();
  if (!origin) {
    return [];
  }
  const base = origin.replace(/\/$/, "");
  return [
    { source: "/api/:path*", destination: `${base}/:path*` },
    { source: "/socket.io/:path*", destination: `${base}/socket.io/:path*` },
  ];
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
    return productionApiProxyRewrites();
  },
};

export default nextConfig;
