import { describe, expect, it, vi } from "vitest";
import { RoomObservabilityService } from "./room-observability.service";
import { RoomRepository } from "./room.repository";
import { RoomService } from "./room.service";

function createRoomService() {
  const repository = new RoomRepository();
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
  it("creates and joins a room, then reassigns host when the original host leaves", () => {
    const { service } = createRoomService();
    const { room } = service.createRoom("host", "Host");
    const joinResult = service.joinRoom(room.roomCode, "guest", "Guest");

    expect(joinResult.ok).toBe(true);

    const leaveResult = service.leaveRoom("host");
    expect(leaveResult.room?.hostId).toBe("guest");
    expect(leaveResult.newHostId).toBe("guest");
  });

  it("hands an in-game player off to a bot and tracks the disconnect handoff metric", () => {
    const { service, observability } = createRoomService();
    const { room } = service.createRoom("host", "Host");
    service.joinRoom(room.roomCode, "guest", "Guest");
    service.setReady("guest", true);
    const started = service.startGame("host");
    expect(started.ok).toBe(true);

    const leaveResult = service.handoffUserToBot("guest");

    expect(leaveResult.handedOffToBot).toBe(true);
    expect(leaveResult.room?.players.find((player) => player.id === "guest")?.isBot).toBe(true);
    expect(observability.snapshot().disconnectHandoffCount).toBe(1);
  });

  it("treats rejoining an existing game seat as a resumed connection and records reconnect success", () => {
    const { service, observability } = createRoomService();
    const { room } = service.createRoom("host", "Host");
    service.joinRoom(room.roomCode, "guest", "Guest");
    service.setReady("guest", true);
    service.startGame("host");
    service.handoffUserToBot("guest");

    const resumed = service.joinRoom(room.roomCode, "guest", "Guest Again");

    expect(resumed.ok).toBe(true);
    if (!resumed.ok) {
      throw new Error("expected resumed room join to succeed");
    }
    expect(resumed.resumed).toBe(true);
    expect(observability.snapshot().reconnectSuccessCount).toBe(1);
  });
});
