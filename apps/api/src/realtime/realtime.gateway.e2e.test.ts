import "reflect-metadata";
import { AddressInfo } from "node:net";
import { afterAll, describe, expect, it } from "vitest";
import { Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { IoAdapter } from "@nestjs/platform-socket.io";
import type {
  ChallengeResult,
  ClientGameState,
  ClientToServerEvents,
  CreateRoomResult,
  JoinResult,
  RoomState,
  ServerToClientEvents,
  SocketActionResult,
} from "@sweet-spicy/shared-types";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeChatService } from "./realtime-chat.service";
import { RealtimeGameplayService } from "./realtime-gameplay.service";
import { RealtimeRoomService } from "./realtime-room.service";
import { RealtimeSessionService } from "./realtime-session.service";
import { SocketRateLimiterService } from "./socket-rate-limiter.service";
import { GameBotDriverService } from "../game/game-bot-driver.service";
import { GameBroadcastService } from "../game/game-broadcast.service";
import { GameLoopService } from "../game/game-loop.service";
import { PrismaService } from "../prisma/prisma.service";
import { RoomObservabilityService } from "../room/room-observability.service";
import { RoomRepository } from "../room/room.repository";
import { RoomSessionPersistenceService } from "../room/room-session-persistence.service";
import { RoomService } from "../room/room.service";
import { io, type Socket } from "socket.io-client";
import { RedisService } from "../redis/redis.service";

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const TEST_JWT_SECRET = "sweet-spicy-dev-secret-change-me";

const fakePrisma = {
  roomSessionSnapshot: {
    upsert: async () => ({}),
    delete: async () => ({}),
  },
  matchSummary: {
    upsert: async () => ({}),
  },
};

const fakeRedis: Pick<
  RedisService,
  "isAvailable" | "set" | "setWithExpiry" | "get" | "del" | "sAdd" | "sRem" | "sMembers" | "sCard" | "mGet"
> = {
  isAvailable: () => false,
  set: async () => undefined,
  setWithExpiry: async () => undefined,
  get: async () => null,
  del: async () => undefined,
  sAdd: async () => undefined,
  sRem: async () => undefined,
  sMembers: async () => [],
  sCard: async () => 0,
  mGet: async () => [],
};

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: TEST_JWT_SECRET,
      signOptions: { expiresIn: "15m" },
    }),
  ],
  providers: [
    { provide: PrismaService, useValue: fakePrisma },
    { provide: RedisService, useValue: fakeRedis },
    RoomRepository,
    RoomObservabilityService,
    RoomSessionPersistenceService,
    RoomService,
    GameBroadcastService,
    GameLoopService,
    GameBotDriverService,
    RealtimeGateway,
    SocketRateLimiterService,
    RealtimeSessionService,
    RealtimeRoomService,
    RealtimeGameplayService,
    RealtimeChatService,
  ],
})
class RealtimeGatewayTestModule {}

async function connectSocket(baseUrl: string, token: string): Promise<TestSocket> {
  return new Promise<TestSocket>((resolve, reject) => {
    const socket: TestSocket = io(baseUrl, {
      transports: ["websocket"],
      auth: { token },
      forceNew: true,
      reconnection: false,
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for socket connection"));
    }, 5_000);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    };

    const onConnect = () => {
      cleanup();
      resolve(socket);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onError);
  });
}

function waitForEvent<K extends keyof ServerToClientEvents>(
  socket: TestSocket,
  event: K,
  timeoutMs = 5_000,
): Promise<Parameters<ServerToClientEvents[K]>[0]> {
  return new Promise<Parameters<ServerToClientEvents[K]>[0]>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, onEvent as never);
      reject(new Error(`Timed out waiting for ${String(event)}`));
    }, timeoutMs);

    const onEvent = (payload: Parameters<ServerToClientEvents[K]>[0]) => {
      clearTimeout(timeout);
      socket.off(event, onEvent as never);
      resolve(payload);
    };

    socket.on(event, onEvent as never);
  });
}

function emitAck<T>(socket: TestSocket, event: keyof ClientToServerEvents, ...args: unknown[]): Promise<T> {
  return new Promise<T>((resolve) => {
    socket.emit(event, ...(args as []), resolve as never);
  });
}

describe("RealtimeGateway socket flow", () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>> | null = null;
  const openSockets = new Set<TestSocket>();

  afterAll(async () => {
    for (const socket of openSockets) {
      socket.disconnect();
    }
    openSockets.clear();
    await app?.close();
  });

  it("handles create, join, ready, start, play, challenge, disconnect, and rejoin", async () => {
    app = await NestFactory.create(RealtimeGatewayTestModule);
    app.useWebSocketAdapter(new IoAdapter(app));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.listen(0);

    const port = (app.getHttpServer().address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const jwt = app.get(JwtService);
    const hostToken = await jwt.signAsync({ sub: "user-host", nickname: "Host" });
    const guestToken = await jwt.signAsync({ sub: "user-guest", nickname: "Guest" });

    const hostSocket = await connectSocket(baseUrl, hostToken);
    const guestSocket = await connectSocket(baseUrl, guestToken);
    openSockets.add(hostSocket);
    openSockets.add(guestSocket);

    const hostJoinedPromise = waitForEvent(hostSocket, "room:joined");
    const createResult = await emitAck<CreateRoomResult>(hostSocket, "room:create", { maxPlayers: 2 });
    expect(createResult.success).toBe(true);
    const hostRoom = await hostJoinedPromise;
    expect(hostRoom.players).toHaveLength(1);

    const guestJoinedPromise = waitForEvent(guestSocket, "room:joined");
    const joinResult = await emitAck<JoinResult>(guestSocket, "room:join", hostRoom.roomCode);
    expect(joinResult.success).toBe(true);
    const guestRoom = await guestJoinedPromise;
    expect(guestRoom.roomCode).toBe(hostRoom.roomCode);
    expect(guestRoom.players).toHaveLength(2);

    const guestReadyResult = await emitAck<SocketActionResult>(guestSocket, "room:ready", true);
    expect(guestReadyResult.success).toBe(true);

    const hostGameStartPromise = waitForEvent(hostSocket, "room:game-start");
    const guestGameStartPromise = waitForEvent(guestSocket, "room:game-start");
    const startResult = await emitAck<SocketActionResult>(hostSocket, "room:start");
    expect(startResult.success).toBe(true);

    const [hostState, guestState] = await Promise.all([hostGameStartPromise, guestGameStartPromise]);
    const currentPlayerId = hostState.players[hostState.currentPlayerIndex]?.id;
    expect(currentPlayerId).toBeTruthy();

    const currentSocket = currentPlayerId === "user-host" ? hostSocket : guestSocket;
    const challengerSocket = currentPlayerId === "user-host" ? guestSocket : hostSocket;
    const currentState = currentPlayerId === "user-host" ? hostState : guestState;
    const currentPlayer = currentState.players.find((player) => player.id === currentPlayerId);
    const cardToPlay = currentPlayer?.hand.find((card) => card.kind === "normal") ?? currentPlayer?.hand[0];
    expect(cardToPlay).toBeTruthy();

    const playResult = await emitAck<SocketActionResult>(currentSocket, "game:play-card", {
      cardId: cardToPlay!.id,
      declaration: {
        type: cardToPlay!.type,
        number: 1,
      },
    });
    expect(playResult.success).toBe(true);

    const claimResult = await emitAck<SocketActionResult>(challengerSocket, "game:claim-challenge");
    expect(claimResult.success).toBe(true);

    const challengeResultPromise = waitForEvent(hostSocket, "game:challenge-result");
    const challengeResultAck = await emitAck<SocketActionResult>(challengerSocket, "game:challenge", {
      challengeType: "suit",
    });
    expect(challengeResultAck.success).toBe(true);

    const challengeResult = await challengeResultPromise;
    expect(challengeResult.playerId).toBe(currentPlayerId);
    expect(challengeResult.challengerId).not.toBe(currentPlayerId);

    guestSocket.disconnect();
    openSockets.delete(guestSocket);

    const rejoinedSocket = await connectSocket(baseUrl, guestToken);
    openSockets.add(rejoinedSocket);

    const rejoinedRoomPromise = waitForEvent(rejoinedSocket, "room:joined");
    const resumedStatePromise = waitForEvent(rejoinedSocket, "game:state-update");
    const rejoinResult = await emitAck<JoinResult>(rejoinedSocket, "room:join", hostRoom.roomCode);
    expect(rejoinResult.success).toBe(true);
    expect("resumed" in rejoinResult ? rejoinResult.resumed : undefined).toBe(true);

    const [rejoinedRoom, resumedState] = await Promise.all([rejoinedRoomPromise, resumedStatePromise]);
    expect(rejoinedRoom.roomCode).toBe(hostRoom.roomCode);
    expect(resumedState.roomCode).toBe(hostRoom.roomCode);
    const resumedGuest = resumedState.players.find((player) => player.id === "user-guest");
    expect(resumedGuest).toBeTruthy();
    expect(resumedGuest?.hand.length).toBeGreaterThan(0);
  });
});
