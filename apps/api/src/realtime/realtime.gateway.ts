import { UsePipes, ValidationPipe } from "@nestjs/common";
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
  claimChallenge,
  drawAndPassTurn,
  playCard,
  resolveChallenge,
} from "@sweet-spicy/game-logic";
import type { Declaration, SocketErrorCode } from "@sweet-spicy/shared-types";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  DEFAULT_ROOM_MAX_PLAYERS,
  SOCKET_ERROR_CODE,
  SOCKET_ERROR_DETAIL_MESSAGE,
  SOCKET_ERROR_MESSAGE,
} from "@sweet-spicy/shared-types";
import { RoomService } from "../room/room.service";
import { GameLoopService } from "../game/game-loop.service";
import { GameBotDriverService } from "../game/game-bot-driver.service";
import { GameBroadcastService } from "../game/game-broadcast.service";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";
import { RoomCreateDto } from "./dto/room-create.dto";
import { PlayCardDto } from "./dto/play-card.dto";
import { ChatSendDto } from "./dto/chat-send.dto";
import { ChallengeDto } from "./dto/challenge.dto";
import { parseRoomJoinCode } from "./parse-room-join";

const SOCKET_VALIDATION_PIPE = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: false,
});

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
    private readonly gameBotDriver: GameBotDriverService,
    private readonly broadcast: GameBroadcastService,
    private readonly rateLimiter: SocketRateLimiterService,
  ) {}

  private emitSocketError(client: Socket, code: SocketErrorCode, message: string): void {
    client.emit("error", { code, message });
  }

  private emitRateLimit(client: Socket): void {
    this.emitSocketError(
      client,
      SOCKET_ERROR_CODE.RATE_LIMIT,
      SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string,
    );
  }

  afterInit(server: Server) {
    this.gameLoop.attachServer(server);
    this.gameBotDriver.attachServer(server);
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
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleCreate(@ConnectedSocket() client: Socket, @MessageBody() data: RoomCreateDto) {
    if (!this.rateLimiter.consume(client.id, "room:create")) {
      this.emitRateLimit(client);
      return { success: false };
    }
    const userId = client.data.userId as string;
    const nickname = client.data.nickname as string;
    const prevSocketRoom = client.data.roomId as string | undefined;
    if (prevSocketRoom) {
      void client.leave(prevSocketRoom);
    }
    const room = this.roomService.createRoom(userId, nickname, data.maxPlayers ?? DEFAULT_ROOM_MAX_PLAYERS);
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
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    if (!this.rateLimiter.consume(client.id, "room:join")) {
      this.emitRateLimit(client);
      return { success: false };
    }
    const code = parseRoomJoinCode(payload);
    if (!code) {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_PAYLOAD, SOCKET_ERROR_DETAIL_MESSAGE.INVALID_ROOM_CODE);
      return { success: false, error: SOCKET_ERROR_DETAIL_MESSAGE.INVALID_ROOM_CODE };
    }
    const userId = client.data.userId as string;
    const nickname = client.data.nickname as string;
    const result = this.roomService.joinRoom(code, userId, nickname);
    if (!result.ok) {
      return { success: false, error: result.error };
    }
    const prevSocketRoom = client.data.roomId as string | undefined;
    if (prevSocketRoom && prevSocketRoom !== result.room.roomCode) {
      void client.leave(prevSocketRoom);
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
    if (!this.rateLimiter.consume(client.id, "room:leave")) {
      this.emitRateLimit(client);
      return { success: false };
    }
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
  handleReady(@ConnectedSocket() client: Socket, @MessageBody() ready: unknown) {
    if (!this.rateLimiter.consume(client.id, "room:ready")) {
      this.emitRateLimit(client);
      return { success: false };
    }
    if (typeof ready !== "boolean") {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_PAYLOAD, SOCKET_ERROR_DETAIL_MESSAGE.READY_NOT_BOOLEAN);
      return { success: false };
    }
    const userId = client.data.userId as string;
    const room = this.roomService.setReady(userId, ready);
    if (!room) return { success: false };
    const roomCode = room.roomCode;
    this.server.to(roomCode).emit("room:player-ready", { playerId: userId, ready });
    return { success: true };
  }

  @SubscribeMessage("room:add-bot")
  handleAddBot(@ConnectedSocket() client: Socket) {
    if (!this.rateLimiter.consume(client.id, "room:add-bot")) {
      this.emitRateLimit(client);
      return { success: false as const, error: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.RATE_LIMIT] as string };
    }
    const userId = client.data.userId as string;
    const socketRoomCode = client.data.roomId as string | undefined;
    const result = this.roomService.addLobbyBot(userId, socketRoomCode);
    if (!result.ok) {
      /** Expected validation errors: return via ack only so clients do not receive global `error` spam. */
      return { success: false as const, error: result.error };
    }
    const roomCode = result.room.roomCode;
    const bot = result.player;
    this.server.to(roomCode).emit("room:player-joined", bot);
    const state = this.roomService.toRoomState(result.room);
    return { success: true as const, room: state, player: bot };
  }

  @SubscribeMessage("room:start")
  handleStart(@ConnectedSocket() client: Socket) {
    if (!this.rateLimiter.consume(client.id, "room:start")) {
      this.emitRateLimit(client);
      return { success: false };
    }
    const userId = client.data.userId as string;
    const result = this.roomService.startGame(userId);
    if (!result.ok) {
      this.emitSocketError(client, SOCKET_ERROR_CODE.START_FAILED, result.error);
      return { success: false, error: result.error };
    }
    const room = result.room;
    if (room.gameState) {
      this.broadcast.emitGameStart(this.server, room.roomCode, room.gameState);
    }
    return { success: true };
  }

  @SubscribeMessage("game:play-card")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handlePlayCard(@ConnectedSocket() client: Socket, @MessageBody() data: PlayCardDto) {
    if (!this.rateLimiter.consume(client.id, "game:play-card")) {
      this.emitRateLimit(client);
      return { success: false };
    }
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) return { success: false };
    const decl = data.declaration as Declaration;
    const next = playCard(room.gameState, userId, data.cardId, decl);
    if (!next) {
      this.emitSocketError(
        client,
        SOCKET_ERROR_CODE.INVALID_MOVE,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_MOVE] as string,
      );
      return { success: false };
    }
    room.gameState = next;
    this.syncRoomPlayers(room);
    this.broadcast.emitStateUpdate(this.server, roomCode, next);
    return { success: true };
  }

  @SubscribeMessage("game:draw-pass")
  handleDrawPass(@ConnectedSocket() client: Socket) {
    if (!this.rateLimiter.consume(client.id, "game:draw-pass")) {
      this.emitRateLimit(client);
      return { success: false };
    }
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) return { success: false };
    const next = drawAndPassTurn(room.gameState, userId);
    if (!next) {
      this.emitSocketError(
        client,
        SOCKET_ERROR_CODE.INVALID_MOVE,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.INVALID_MOVE] as string,
      );
      return { success: false };
    }
    room.gameState = next;
    this.syncRoomPlayers(room);
    this.broadcast.emitStateUpdate(this.server, roomCode, next);
    return { success: true };
  }

  @SubscribeMessage("game:claim-challenge")
  handleClaimChallenge(@ConnectedSocket() client: Socket) {
    if (!this.rateLimiter.consume(client.id, "game:claim-challenge")) {
      this.emitRateLimit(client);
      return { success: false };
    }
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) return { success: false };
    if (room.gameState.phase !== "CHALLENGE_PHASE") {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_WRONG_PHASE);
      return { success: false };
    }
    if (room.gameState.playedCard?.playerId === userId) {
      this.emitSocketError(
        client,
        SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF] as string,
      );
      return { success: false };
    }
    const next = claimChallenge(room.gameState, userId);
    if (!next) {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_MOVE, "Cannot claim challenge now");
      return { success: false };
    }
    room.gameState = next;
    this.syncRoomPlayers(room);
    this.broadcast.emitStateUpdate(this.server, roomCode, next);
    return { success: true };
  }

  @SubscribeMessage("game:challenge")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleChallenge(@ConnectedSocket() client: Socket, @MessageBody() data: ChallengeDto) {
    if (!this.rateLimiter.consume(client.id, "game:challenge")) {
      this.emitRateLimit(client);
      return { success: false };
    }
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) return { success: false };
    if (room.gameState.phase !== "CHALLENGE_PHASE") {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_DETAIL_MESSAGE.CHALLENGE_WRONG_PHASE);
      return { success: false };
    }
    if (room.gameState.playedCard?.playerId === userId) {
      this.emitSocketError(
        client,
        SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF] as string,
      );
      return { success: false };
    }
    if (
      room.gameState.challengeStep !== "PICK_TYPE" ||
      room.gameState.challengeClaimHolderId !== userId
    ) {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_MOVE, "Only the challenge holder can pick suit or number");
      return { success: false };
    }
    const next = resolveChallenge(room.gameState, userId, data.challengeType);
    room.gameState = next;
    this.syncRoomPlayers(room);
    this.broadcast.emitStateUpdate(this.server, roomCode, next);
    if (next.challengeResult) {
      this.server.to(roomCode).emit("game:challenge-result", next.challengeResult);
    }
    return { success: true };
  }

  @SubscribeMessage("game:accept")
  handleAccept(@ConnectedSocket() client: Socket) {
    if (!this.rateLimiter.consume(client.id, "game:accept")) {
      this.emitRateLimit(client);
      return { success: false };
    }
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    if (!roomCode) return { success: false };
    const room = this.roomService.getRoomByCode(roomCode);
    if (!room?.gameState) return { success: false };
    if (room.gameState.phase !== "CHALLENGE_PHASE") {
      this.emitSocketError(client, SOCKET_ERROR_CODE.INVALID_PHASE, SOCKET_ERROR_DETAIL_MESSAGE.ACCEPT_WRONG_PHASE);
      return { success: false };
    }
    if (room.gameState.playedCard?.playerId === userId) {
      return { success: false };
    }
    const next = acceptDeclaration(room.gameState);
    room.gameState = next;
    this.syncRoomPlayers(room);
    this.broadcast.emitStateUpdate(this.server, roomCode, next);
    return { success: true };
  }

  @SubscribeMessage("chat:send")
  @UsePipes(SOCKET_VALIDATION_PIPE)
  handleChat(@ConnectedSocket() client: Socket, @MessageBody() body: ChatSendDto) {
    if (!this.rateLimiter.consume(client.id, "chat:send")) {
      this.emitSocketError(client, SOCKET_ERROR_CODE.RATE_LIMIT, SOCKET_ERROR_DETAIL_MESSAGE.TOO_MANY_MESSAGES);
      return { success: false };
    }
    const roomCode = client.data.roomId as string | undefined;
    const userId = client.data.userId as string;
    const nickname = client.data.nickname as string;
    if (!roomCode) return { success: false };
    const content = body.content.trim();
    if (!content) return { success: false };
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      playerId: userId,
      nickname,
      content: content.slice(0, CHAT_MESSAGE_MAX_LENGTH),
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
    this.roomService.syncRoomPlayersFromGame(room);
  }
}
