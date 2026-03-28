import { Injectable } from "@nestjs/common";

const RATE_WINDOW_MS = 1000;

/** Max events per window per socket (by event name). */
const EVENT_LIMITS: Readonly<Record<string, number>> = {
  "chat:send": 8,
  "game:claim-challenge": 10,
  "game:challenge": 6,
  "game:accept": 6,
  "game:play-card": 20,
  "game:draw-pass": 12,
  "room:create": 4,
  "room:join": 12,
  "room:ready": 20,
  "room:start": 4,
  "room:leave": 10,
};

const DEFAULT_LIMIT = 40;

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class SocketRateLimiterService {
  private readonly buckets = new Map<string, Bucket>();

  /**
   * Returns true if the event is allowed; false if rate limited.
   */
  consume(socketId: string, eventName: string): boolean {
    const limit = EVENT_LIMITS[eventName] ?? DEFAULT_LIMIT;
    const key = `${socketId}:${eventName}`;
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + RATE_WINDOW_MS };
      this.buckets.set(key, b);
    }
    b.count += 1;
    return b.count <= limit;
  }
}
