import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
  MediaParticipant,
  SocketErrorCode,
  ServerToClientEvents,
} from "@sweet-spicy/shared-types";
import {
  SOCKET_ERROR_CODE,
  SOCKET_ERROR_MESSAGE,
} from "@sweet-spicy/shared-types";
import { GameBroadcastService } from "../game/game-broadcast.service";
import { MediaPresenceService } from "./media-presence.service";
import type { RealtimeServer, RealtimeSocket } from "./realtime-socket.types";
import { RoomService, type LeaveRoomResult } from "../room/room.service";
import { emitSocketError } from "./realtime-action-result";

const DISCONNECT_GRACE_PERIOD_MS = 5_000;

@Injectable()
export class RealtimeSessionService {
  private server: RealtimeServer | null = null;
  private readonly activeSocketIdsByUser = new Map<string, Set<string>>();
  private readonly disconnectTimersByUser = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly mediaDisconnectTimersBySocket = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly roomService: RoomService,
    private readonly broadcast: GameBroadcastService,
    private readonly mediaPresence: MediaPresenceService,
  ) {}

  attachServer(server: RealtimeServer): void {
    this.server = server;
  }

  bindAuthMiddleware(): void {
    if (!this.server) {
      throw new Error("RealtimeSessionService.attachServer must be called before bindAuthMiddleware");
    }

    this.server.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) {
          return next(new Error("Unauthorized"));
        }
        const payload = this.jwt.verify<{ sub: string; nickname: string }>(token);
        socket.data.userId = payload.sub;
        socket.data.nickname = payload.nickname;
        next();
      } catch {
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

    this.scheduleMediaDisconnect(client.id);

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
      this.leaveUserFromCurrentRoom(userId);
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

  getResolvedRoomCode(client: RealtimeSocket, requestedRoomCode?: string): string | null {
    if (requestedRoomCode && requestedRoomCode.trim().length > 0) {
      return requestedRoomCode.trim().toUpperCase();
    }

    const userId = client.data.userId;
    if (!userId) {
      return null;
    }

    const roomForUser = this.roomService.getRoomForUser(userId);
    if (roomForUser) {
      return roomForUser.roomCode;
    }

    return client.data.roomId?.toUpperCase() ?? null;
  }

  getRoomForMediaAction(client: RealtimeSocket, requestedRoomCode?: string) {
    const roomCode = this.getResolvedRoomCode(client, requestedRoomCode);
    if (!roomCode) {
      return null;
    }

    return this.roomService.getRoomByCode(roomCode) ?? null;
  }

  finalizeRoomExit(userId: string, leaveResult: LeaveRoomResult): void {
    if (!this.server || !leaveResult.roomCode) {
      return;
    }

    const mediaParticipant = this.mediaPresence.leaveRoom(leaveResult.roomCode, userId);
    if (mediaParticipant) {
      this.server.to(leaveResult.roomCode).emit("webrtc:peer-left", {
        peerId: mediaParticipant.peerId,
      });
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

  getActiveSocketIdsForUser(userId: string): ReadonlySet<string> {
    return this.activeSocketIdsByUser.get(userId) ?? new Set<string>();
  }

  emitToMediaPeer<K extends "webrtc:offer" | "webrtc:answer" | "webrtc:ice-candidate">(
    roomCode: string,
    peerId: string,
    event: K,
    ...payload: Parameters<ServerToClientEvents[K]>
  ): boolean {
    const targetSocketId = this.mediaPresence.getParticipantSocketId(roomCode, peerId);
    if (!targetSocketId) {
      return false;
    }

    const targetSocket = this.getActiveSocketsForUser(peerId).find((socket) => socket.id === targetSocketId);
    if (!targetSocket) {
      return false;
    }

    targetSocket.emit(event, ...payload);
    return true;
  }

  emitMediaState(roomCode: string, participant: MediaParticipant): void {
    this.server?.to(roomCode).emit("webrtc:peer-media-state", {
      peerId: participant.peerId,
      audioEnabled: participant.audioEnabled,
      videoEnabled: participant.videoEnabled,
    });
  }

  clearMediaDisconnectTimer(socketId: string): void {
    const disconnectTimer = this.mediaDisconnectTimersBySocket.get(socketId);
    if (!disconnectTimer) {
      return;
    }

    clearTimeout(disconnectTimer);
    this.mediaDisconnectTimersBySocket.delete(socketId);
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

  private leaveUserFromCurrentRoom(userId: string): void {
    const room = this.roomService.getRoomForUser(userId);
    const leaveResult = room?.gameState
      ? this.roomService.handoffUserToBot(userId)
      : this.roomService.leaveRoom(userId);

    this.finalizeRoomExit(userId, leaveResult);
  }

  private scheduleMediaDisconnect(socketId: string): void {
    const roomCode = this.mediaPresence.getRoomCodeForSocket(socketId);
    if (!roomCode || !this.server) {
      return;
    }

    const existingDisconnectTimer = this.mediaDisconnectTimersBySocket.get(socketId);
    if (existingDisconnectTimer) {
      clearTimeout(existingDisconnectTimer);
    }

    const disconnectTimer = setTimeout(() => {
      this.mediaDisconnectTimersBySocket.delete(socketId);
      const participant = this.mediaPresence.leaveBySocket(socketId);
      if (!participant) {
        return;
      }

      this.server?.to(roomCode).emit("webrtc:peer-left", { peerId: participant.peerId });
    }, DISCONNECT_GRACE_PERIOD_MS);

    this.mediaDisconnectTimersBySocket.set(socketId, disconnectTimer);
  }
}
