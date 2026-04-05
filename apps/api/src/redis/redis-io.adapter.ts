import { Logger } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { ServerOptions } from "socket.io";
import { RedisService } from "./redis.service";

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    private readonly redisService: RedisService,
    app: unknown,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const clients = await this.redisService.createAdapterClients();
    if (!clients) {
      this.logger.warn("Socket.IO is using default in-memory adapter (Redis adapter disabled).");
      return;
    }

    this.adapterConstructor = createAdapter(clients.pubClient, clients.subClient);
    this.logger.log("Socket.IO Redis adapter is enabled.");
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
