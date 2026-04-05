import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  SOCKET_ERROR_CODE,
  SOCKET_ERROR_MESSAGE,
} from "@sweet-spicy/shared-types";
import { GameBroadcastService } from "../game/game-broadcast.service";
import type { RealtimeServer, RealtimeSocket } from "./realtime-socket.types";
import { RoomService, type LeaveRoomResult } from "../room/room.service";
import { emitSocketError } from "./realtime-action-result";

const DISCONNECT_GRACE_PERIOD_MS = 5_000;

@Injectable()
export class RealtimeSessionService {
  private readonly logger = new Logger(RealtimeSessionService.name);
  private server: RealtimeServer | null = null;
  private readonly activeSocketIdsByUser = new Map<string, Set<string>>();
  private readonly disconnectTimersByUser = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly roomService: RoomService,
    private readonly broadcast: GameBroadcastService,
  ) {}

  attachServer(server: RealtimeServer): void {
    this.server = server;
  }

  bindAuthMiddleware(): void {
    if (!this.server) {
      throw new Error("RealtimeSessionService.attachServer must be called before bindAuthMiddleware");
    }

    this.server.use((socket, next) => {
      const origin = socket.handshake.headers.origin ?? "(no Origin)";
      try {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) {
          this.logger.warn(`Socket rejected: missing auth token (origin=${origin})`);
          return next(new Error("Unauthorized"));
        }
        const payload = this.jwt.verify<{ sub: string; nickname: string }>(token);
        socket.data.userId = payload.sub;
        socket.data.nickname = payload.nickname;
        next();
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : "verify failed";
        this.logger.warn(`Socket rejected: ${reason} (origin=${origin})`);
        next(new Error("Unauthorized"));
      }
    });
  }

  handleConnection(client: RealtimeSocket): void {
    const userId = client.data.userId;
    if (!userId) {
      return;
    }

    const activeSocketIds = this.activeSocketIdsByUser.get(userId) ?? new Set<string>();
    activeSocketIds.add(client.id);
    this.activeSocketIdsByUser.set(userId, activeSocketIds);

    const pendingDisconnect = this.disconnectTimersByUser.get(userId);
    if (!pendingDisconnect) {
      return;
    }

    clearTimeout(pendingDisconnect);
    this.disconnectTimersByUser.delete(userId);
  }

  handleDisconnect(client: RealtimeSocket): void {
    const userId = client.data.userId;
    if (!userId) {
      return;
    }

    const activeSocketIds = this.activeSocketIdsByUser.get(userId);
    if (activeSocketIds) {
      activeSocketIds.delete(client.id);
      if (activeSocketIds.size === 0) {
        this.activeSocketIdsByUser.delete(userId);
      }
    }

    if (this.activeSocketIdsByUser.has(userId)) {
      return;
    }

    const existingDisconnectTimer = this.disconnectTimersByUser.get(userId);
    if (existingDisconnectTimer) {
      clearTimeout(existingDisconnectTimer);
    }

    const disconnectTimer = setTimeout(() => {
      this.disconnectTimersByUser.delete(userId);
      void this.leaveUserFromCurrentRoom(userId);
    }, DISCONNECT_GRACE_PERIOD_MS);
    this.disconnectTimersByUser.set(userId, disconnectTimer);
  }

  requireUserId(client: RealtimeSocket): string {
    const userId = client.data.userId;
    if (!userId) {
      throw new Error("Unauthorized");
    }

    return userId;
  }

  requireNickname(client: RealtimeSocket): string {
    const nickname = client.data.nickname;
    if (!nickname) {
      throw new Error("Unauthorized");
    }

    return nickname;
  }

  async finalizeRoomExit(userId: string, leaveResult: LeaveRoomResult): Promise<void> {
    if (!this.server || !leaveResult.roomCode) {
      return;
    }

    this.clearRoomMembershipFromActiveSockets(userId, leaveResult.roomCode);

    if (leaveResult.handedOffToBot && leaveResult.room?.gameState) {
      this.broadcast.emitStateUpdate(this.server, leaveResult.roomCode, leaveResult.room.gameState);
      return;
    }

    if (!leaveResult.room) {
      return;
    }

    this.server.to(leaveResult.roomCode).emit("room:player-left", { playerId: userId });
    if (leaveResult.newHostId) {
      this.server.to(leaveResult.roomCode).emit("room:host-changed", {
        newHostId: leaveResult.newHostId,
      });
    }
  }

  getMetricsSnapshot(): { activeSockets: number; activeUsers: number } {
    let activeSockets = 0;
    for (const socketIds of this.activeSocketIdsByUser.values()) {
      activeSockets += socketIds.size;
    }

    return {
      activeSockets,
      activeUsers: this.activeSocketIdsByUser.size,
    };
  }

  rateLimitFailure(client: RealtimeSocket): {
    success: false;
    code: typeof SOCKET_ERROR_CODE.RATE_LIMIT;
    message: string;
  } {
    emitSocketError(client, SOCKET_ERROR_CODE.RATE_LIMIT, SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string);
    return {
      success: false as const,
      code: SOCKET_ERROR_CODE.RATE_LIMIT,
      message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
    };
  }

  getServer(): RealtimeServer {
    if (!this.server) {
      throw new Error("RealtimeSessionService.attachServer must be called before getServer");
    }

    return this.server;
  }

  private getActiveSocketsForUser(userId: string): RealtimeSocket[] {
    if (!this.server) {
      return [];
    }

    const activeSocketIds = this.activeSocketIdsByUser.get(userId);
    if (!activeSocketIds) {
      return [];
    }

    return Array.from(activeSocketIds)
      .map((socketId) => this.server?.sockets.sockets.get(socketId))
      .filter((socket): socket is RealtimeSocket => socket != null);
  }

  private clearRoomMembershipFromActiveSockets(userId: string, roomCode: string): void {
    for (const socket of this.getActiveSocketsForUser(userId)) {
      void socket.leave(roomCode);
      socket.data.roomId = undefined;
    }
  }

  private async leaveUserFromCurrentRoom(userId: string): Promise<void> {
    const room = await this.roomService.getRoomForUser(userId);
    const leaveResult = room?.gameState
      ? await this.roomService.handoffUserToBot(userId)
      : await this.roomService.leaveRoom(userId);

    await this.finalizeRoomExit(userId, leaveResult);
  }
}
