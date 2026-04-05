import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Local API default when `API_INTERNAL_ORIGIN` is unset (matches dev Nest in this repo). */
const DEFAULT_LOCAL_API_ORIGIN = "http://127.0.0.1:3001";

function backendOrigin(): string {
  const raw = process.env.API_INTERNAL_ORIGIN?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  return DEFAULT_LOCAL_API_ORIGIN;
}

const HOP_BY_HOP_REQUEST = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function buildTargetUrl(req: NextRequest, pathSegments: string[] | undefined): URL {
  const path = pathSegments?.filter(Boolean).join("/") ?? "";
  const suffix = path ? `/${path}` : "";
  const incoming = new URL(req.url);
  return new URL(`${backendOrigin()}${suffix}${incoming.search}`);
}

function forwardRequestHeaders(req: NextRequest): Headers {
  const out = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "host" || HOP_BY_HOP_REQUEST.has(lower)) {
      return;
    }
    out.set(key, value);
  });
  return out;
}

function forwardResponseHeaders(source: Headers): Headers {
  const out = new Headers();
  source.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_REQUEST.has(lower)) {
      return;
    }
    out.append(key, value);
  });
  return out;
}

async function proxy(req: NextRequest, pathSegments: string[] | undefined): Promise<Response> {
  const target = buildTargetUrl(req, pathSegments);
  const method = req.method.toUpperCase();
  const headers = forwardRequestHeaders(req);

  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half";
  }

  const upstream = await fetch(target, init);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: forwardResponseHeaders(upstream.headers),
  });
}

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function HEAD(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function OPTIONS(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
