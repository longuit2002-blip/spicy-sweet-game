import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import type { Server, Socket } from "socket.io";
import {
  acceptDeclaration,
  playCard,
  resolveChallenge,
} from "@sweet-spicy/game-logic";
import type { Declaration } from "@sweet-spicy/shared-types";
import { RoomService } from "../room/room.service";
import { GameLoopService } from "../game/game-loop.service";

@WebSocketGateway({
  cors: { origin: process.env.CLIENT_URL ?? "*", credentials: true },
  transports: ["websocket", "polling"],
})
export class RealtimeGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly roomService: RoomService,
    private readonly gameLoop: GameLoopService,
  ) {}

  afterInit(server: Server) {
    this.gameLoop.attachServer(server);
    server.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) {
          return next(new Error("Unauthorized"));
        }
        const p = this.jwt.verify<{ sub: string; nickname: string }>(token);
        socket.data.userId = p.sub;
        socket.data.nickname = p.nickname;
        next();
      } catch {
        next(new Error("Unauthorized"));
      }
    });
  }

  @SubscribeMessage("room:create")
  handleCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { maxPlayers?: number; isPrivate?: boolean },
  ) {
    const userId = client.data.userId as string;
    const nickname = client.data.nickname as string;
    const room = this.roomService.createRoom(userId, nickname, data?.maxPlayers ?? 6);
    void client.join(room.roomCode);
    client.data.roomId = room.roomCode;
    const state = this.roomService.toRoomState(room);
    client.emit("room:joined", state);
    return {
      success: true,
      room: state,
    };
  }

  @SubscribeMessage("room:join")
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: string | { roomCode?: string; code?: string },
  ) {
    const userId = client.data.userId as string;
    const nickname = client.data.nickname as string;
    const code =
      typeof payload === "string"
        ? payload
        : (payload?.roomCode ?? payload?.code ?? "");
    const result = this.roomService.joinRoom(code, userId, nickname);
    if (!result.ok) {
      return { success: false, error: result.error };
    }
    void client.join(result.room.roomCode);
    client.data.roomId = result.room.roomCode;
    const joined = result.room.players.find((p) => p.id === userId)!;
    client.to(result.room.roomCode).emit("room:player-joined", joined);
    const state = this.roomService.toRoomState(result.room);
    client.emit("room:joined", state);
    return {
      success: true,
      room: state,
    };
  }

  @SubscribeMessage("room:leave")
  handleLeave(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as string;
    const { roomCode, room, newHostId } = this.roomService.leaveRoom(userId);
    if (roomCode && room) {
      void client.leave(roomCode);
      client.to(roomCode).emit("room:player-left", { playerId: userId });
      if (newHostId) {
        this.server.to(roomCode).emit("room:host-changed", { newHostId });
      }
    }
    client.data.roomId = undefined;
    return { success: true };
  }

  @SubscribeMessage("room:ready")
  handleReady(@ConnectedSocket() client: Socket, @MessageBody() ready: boolean) {
    const userId = client.data.userId as string;
    const room = this.roomService.setReady(userId, ready);
    if (!room) return { success: false };
    const roomCode = room.roomCode;
    this.server.to(roomCode).emit("room:player-ready", { playerId: userId, ready });
    return { success: true };
  }

  @SubscribeMessage("room:start")
  handleStart(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as string;
    const result = this.roomService.startGame(userId);
    if (!result.ok) {
      client.emit("error", { code: "START_FAILED", message: result.error });
      return { success: false, error: result.error };
    }
    const room = result.room;
    if (room.gameState) {
      this.server.to(room.roomCode).emit("room:game-start", room.gameState);
    }
    return { success: true };
  }

  @SubscribeMessage("game:play-card")
  handlePlayCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cardId: string; declaration: Declaration },
  ) {
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) return { success: false };
    const next = playCard(room.gameState, userId, data.cardId, data.declaration);
    if (!next) {
      client.emit("error", { code: "INVALID_MOVE", message: "Cannot play this card" });
      return { success: false };
    }
    room.gameState = next;
    this.syncRoomPlayers(room);
    this.server.to(roomCode).emit("game:state-update", next);
    return { success: true };
  }

  @SubscribeMessage("game:challenge")
  handleChallenge(@ConnectedSocket() client: Socket) {
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) return { success: false };
    if (room.gameState.playedCard?.playerId === userId) {
      client.emit("error", { code: "CANNOT_CHALLENGE_SELF", message: "Cannot challenge yourself" });
      return { success: false };
    }
    const next = resolveChallenge(room.gameState, userId);
    room.gameState = next;
    this.syncRoomPlayers(room);
    this.server.to(roomCode).emit("game:state-update", next);
    if (next.challengeResult) {
      this.server.to(roomCode).emit("game:challenge-result", next.challengeResult);
    }
    return { success: true };
  }

  @SubscribeMessage("game:accept")
  handleAccept(@ConnectedSocket() client: Socket) {
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) return { success: false };
    if (room.gameState.playedCard?.playerId === userId) {
      return { success: false };
    }
    const next = acceptDeclaration(room.gameState);
    room.gameState = next;
    this.syncRoomPlayers(room);
    this.server.to(roomCode).emit("game:state-update", next);
    return { success: true };
  }

  @SubscribeMessage("chat:send")
  handleChat(@ConnectedSocket() client: Socket, @MessageBody() content: string) {
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    const nickname = client.data.nickname as string;
    if (!roomCode || !content?.trim()) return { success: false };
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      playerId: userId,
      nickname,
      content: content.trim().slice(0, 200),
      type: "text" as const,
      timestamp: new Date().toISOString(),
    };
    this.server.to(roomCode).emit("chat:message", msg);
    return { success: true };
  }

  @SubscribeMessage("webrtc:join-room")
  handleWebrtcJoin(@ConnectedSocket() client: Socket, @MessageBody() _roomCode?: string) {
    const roomCode = (client.data.roomId as string) ?? _roomCode;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    client.to(roomCode).emit("webrtc:peer-joined", { peerId: userId });
    return { success: true };
  }

  @SubscribeMessage("webrtc:leave-room")
  handleWebrtcLeave(@ConnectedSocket() client: Socket) {
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    client.to(roomCode).emit("webrtc:peer-left", { peerId: userId });
    return { success: true };
  }

  @SubscribeMessage("webrtc:offer")
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { peerId: string; offer: RTCSessionDescriptionInit },
  ) {
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    client.to(roomCode).emit("webrtc:offer", { peerId: userId, offer: data.offer });
    return { success: true };
  }

  @SubscribeMessage("webrtc:answer")
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { peerId: string; answer: RTCSessionDescriptionInit },
  ) {
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    client.to(roomCode).emit("webrtc:answer", { peerId: userId, answer: data.answer });
    return { success: true };
  }

  @SubscribeMessage("webrtc:ice-candidate")
  handleIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { peerId: string; candidate: RTCIceCandidateInit },
  ) {
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    client.to(roomCode).emit("webrtc:ice-candidate", { peerId: userId, candidate: data.candidate });
    return { success: true };
  }

  private syncRoomPlayers(room: import("../room/room.service").ServerRoom) {
    if (!room.gameState) return;
    room.players = room.gameState.players.map((gp) => ({
      id: gp.id,
      nickname: gp.nickname,
      isHost: room.hostId === gp.id,
      isReady: true,
      score: gp.score,
      hand: gp.hand,
      successfulBluffs: gp.successfulBluffs,
      successfulChallenges: gp.successfulChallenges,
    }));
  }
}
