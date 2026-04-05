/**
 * CORS + Socket.IO `cors.origin` for browser clients.
 * Set `CLIENT_URL` on the VM to the exact public site origin, e.g. `https://your.domain`.
 * Comma-separated list is supported: `https://app.example.com,http://localhost:3000`
 */
export function getClientOriginsEnv(): string {
  return process.env.CLIENT_URL ?? "http://localhost:3000";
}

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function getClientOriginsList(): string[] {
  return getClientOriginsEnv()
    .split(",")
    .map((s) => normalizeOrigin(s))
    .filter((s) => s.length > 0);
}

/** Single origin or array for Nest `enableCors` / Socket.IO gateway `cors.origin`. */
export function getClientCorsOrigin(): string | string[] {
  const list = getClientOriginsList();
  if (list.length === 0) {
    return "http://localhost:3000";
  }
  if (list.length === 1) {
    return list[0]!;
  }
  return list;
}
