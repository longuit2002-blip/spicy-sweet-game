import { describe, expect, it, vi } from "vitest";
import { RedisService } from "../redis/redis.service";
import { RoomObservabilityService } from "./room-observability.service";
import { RoomRepository } from "./room.repository";
import { RoomService } from "./room.service";

function createRoomService() {
  const redis: Pick<
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
  const repository = new RoomRepository(redis as RedisService);
  const observability = new RoomObservabilityService();
  const persistence = {
    persistRoomSnapshot: vi.fn(),
    deleteRoomSnapshot: vi.fn(),
    persistMatchSummary: vi.fn(),
  };

  return {
    repository,
    observability,
    persistence,
    service: new RoomService(
      repository,
      persistence as never,
      observability,
    ),
  };
}

describe("RoomService", () => {
  it("creates and joins a room, then reassigns host when the original host leaves", async () => {
    const { service } = createRoomService();
    const { room } = await service.createRoom("host", "Host");
    const joinResult = await service.joinRoom(room.roomCode, "guest", "Guest");

    expect(joinResult.ok).toBe(true);

    const leaveResult = await service.leaveRoom("host");
    expect(leaveResult.room?.hostId).toBe("guest");
    expect(leaveResult.newHostId).toBe("guest");
  });

  it("hands an in-game player off to a bot and tracks the disconnect handoff metric", async () => {
    const { service, observability } = createRoomService();
    const { room } = await service.createRoom("host", "Host");
    await service.joinRoom(room.roomCode, "guest", "Guest");
    await service.setReady("guest", true);
    const started = await service.startGame("host");
    expect(started.ok).toBe(true);

    const leaveResult = await service.handoffUserToBot("guest");

    expect(leaveResult.handedOffToBot).toBe(true);
    expect(leaveResult.room?.players.find((player) => player.id === "guest")?.isBot).toBe(true);
    expect(observability.snapshot().disconnectHandoffCount).toBe(1);
  });

  it("treats rejoining an existing game seat as a resumed connection and records reconnect success", async () => {
    const { service, observability } = createRoomService();
    const { room } = await service.createRoom("host", "Host");
    await service.joinRoom(room.roomCode, "guest", "Guest");
    await service.setReady("guest", true);
    await service.startGame("host");
    await service.handoffUserToBot("guest");

    const resumed = await service.joinRoom(room.roomCode, "guest", "Guest Again");

    expect(resumed.ok).toBe(true);
    if (!resumed.ok) {
      throw new Error("expected resumed room join to succeed");
    }
    expect(resumed.resumed).toBe(true);
    expect(observability.snapshot().reconnectSuccessCount).toBe(1);
  });
});
