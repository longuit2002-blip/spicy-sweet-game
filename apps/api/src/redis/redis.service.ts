import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createClient } from "redis";

type RedisValue = string | number;
type RedisClient = ReturnType<typeof createClient>;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClient | null = null;
  private available = false;

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
      this.logger.warn("REDIS_URL is not set. Falling back to in-memory room repository.");
      return;
    }

    const client = createClient({ url: redisUrl });
    client.on("error", (error) => {
      this.logger.error(`Redis client error: ${String(error)}`);
    });

    try {
      await client.connect();
      this.client = client;
      this.available = true;
      this.logger.log(`Connected to Redis at ${redisUrl}`);
    } catch (error) {
      this.logger.error(`Failed to connect to Redis at ${redisUrl}: ${String(error)}`);
      this.available = false;
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.quit().catch(() => undefined);
    this.client = null;
    this.available = false;
  }

  isAvailable(): boolean {
    return this.available && this.client != null;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) {
      return null;
    }
    return this.client.get(key);
  }

  async set(key: string, value: RedisValue): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.set(key, String(value));
  }

  async setWithExpiry(key: string, value: RedisValue, ttlSeconds: number): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.set(key, String(value), { EX: ttlSeconds });
  }

  async del(key: string): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.del(key);
  }

  async sAdd(key: string, value: string): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.sAdd(key, value);
  }

  async sRem(key: string, value: string): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.sRem(key, value);
  }

  async sMembers(key: string): Promise<string[]> {
    if (!this.client) {
      return [];
    }
    return this.client.sMembers(key);
  }

  async sCard(key: string): Promise<number> {
    if (!this.client) {
      return 0;
    }
    return this.client.sCard(key);
  }

  async mGet(keys: string[]): Promise<Array<string | null>> {
    if (!this.client || keys.length === 0) {
      return [];
    }
    return this.client.mGet(keys);
  }

  async createAdapterClients():
    Promise<{ pubClient: RedisClient; subClient: RedisClient } | null> {
    if (!this.client || !this.available) {
      return null;
    }

    const pubClient = this.client.duplicate();
    const subClient = this.client.duplicate();

    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      return { pubClient, subClient };
    } catch (error) {
      this.logger.error(`Failed to create Socket.IO Redis adapter clients: ${String(error)}`);
      await Promise.all([
        pubClient.quit().catch(() => undefined),
        subClient.quit().catch(() => undefined),
      ]);
      return null;
    }
  }
}
