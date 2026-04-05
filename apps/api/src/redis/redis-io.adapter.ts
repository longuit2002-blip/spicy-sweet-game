import { Logger } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Server as SocketIoServer } from "socket.io";
import type { ServerOptions } from "socket.io";
import { RedisService } from "./redis.service";

const REDIS_ADAPTER_ATTACH_POLL_MS = 25;
const REDIS_ADAPTER_ATTACH_TIMEOUT_MS = 15_000;

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  /** Serializes `ensureAdapterFromRedis` when multiple gateway servers mount in parallel. */
  private adapterInitChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly redisService: RedisService,
    app: unknown,
  ) {
    super(app);
  }

  /**
   * Nest mounts WebSocket gateways during `registerModules()`, before `OnModuleInit`
   * (where `RedisService` connects). Optional early call from bootstrap; the real attach
   * happens in `createIOServer` once Redis is reachable.
   */
  async connectToRedis(): Promise<void> {
    await this.ensureAdapterFromRedis();
  }

  private async ensureAdapterFromRedis(): Promise<void> {
    if (this.adapterConstructor) {
      return;
    }

    this.adapterInitChain = this.adapterInitChain.then(async () => {
      if (this.adapterConstructor) {
        return;
      }
      const clients = await this.redisService.createAdapterClients();
      if (!clients) {
        return;
      }
      this.adapterConstructor = createAdapter(clients.pubClient, clients.subClient);
      this.logger.log("Socket.IO Redis adapter is enabled.");
    });

    await this.adapterInitChain;
  }

  private async attachRedisAdapterWhenReady(server: SocketIoServer): Promise<void> {
    if (!process.env.REDIS_URL?.trim()) {
      this.logger.warn("Socket.IO is using default in-memory adapter (REDIS_URL unset).");
      return;
    }

    const deadline = Date.now() + REDIS_ADAPTER_ATTACH_TIMEOUT_MS;
    while (!this.redisService.isAvailable() && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, REDIS_ADAPTER_ATTACH_POLL_MS));
    }

    await this.ensureAdapterFromRedis();
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      return;
    }

    this.logger.warn(
      "Socket.IO is using default in-memory adapter (Redis adapter could not attach — check REDIS_URL and Redis health).",
    );
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    void this.attachRedisAdapterWhenReady(server);
    return server;
  }
}
