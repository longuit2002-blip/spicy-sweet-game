import { Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { GAME_LOOP_TICK_INTERVAL_MS } from "./game-loop.constants";
import { nextTurn, tickChallengePhase, tickRevealPhase } from "@sweet-spicy/game-logic";
import type { GameState } from "@sweet-spicy/shared-types";
import { GameBroadcastService } from "./game-broadcast.service";
import type { RealtimeServer } from "../realtime/realtime-socket.types";
import { RoomRepository } from "../room/room.repository";
import { RoomService } from "../room/room.service";

@Injectable()
export class GameLoopService {
  private server: RealtimeServer | null = null;

  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly roomService: RoomService,
    private readonly broadcast: GameBroadcastService,
  ) {}

  attachServer(server: RealtimeServer) {
    this.server = server;
  }

  @Interval(GAME_LOOP_TICK_INTERVAL_MS)
  tick() {
    if (!this.server) return;

    for (const [roomCode, room] of this.roomRepository.getRoomEntries()) {
      if (!room.gameState) continue;
      const prevPhase = room.gameState.phase;
      let gs: GameState = room.gameState;

      if (gs.phase === "CHALLENGE_PHASE") {
        gs = tickChallengePhase(gs);
        room.gameState = gs;
        this.roomService.syncRoomPlayersFromGame(room);
        this.broadcast.emitStateUpdate(this.server, roomCode, gs);
        if (prevPhase !== "END_GAME" && gs.phase === "END_GAME") {
          this.broadcast.emitWinner(this.server, roomCode, gs);
        }
        continue;
      }

      if (gs.phase === "REVEAL") {
        gs = tickRevealPhase(gs);
        room.gameState = gs;
        this.roomService.syncRoomPlayersFromGame(room);
        this.broadcast.emitStateUpdate(this.server, roomCode, gs);
        if (prevPhase !== "END_GAME" && gs.phase === "END_GAME") {
          this.broadcast.emitWinner(this.server, roomCode, gs);
        }
        continue;
      }

      if (gs.phase === "PENALTY" || gs.phase === "NEXT_TURN" || gs.phase === "TROPHY_AWARDED") {
        const nextTimer = Math.max(0, gs.challengeTimer - 1);
        gs = { ...gs, challengeTimer: nextTimer };
        if (nextTimer <= 0) {
          gs = nextTurn(gs);
        }
        room.gameState = gs;
        this.roomService.syncRoomPlayersFromGame(room);
        this.broadcast.emitStateUpdate(this.server, roomCode, gs);
        if (prevPhase !== "END_GAME" && gs.phase === "END_GAME") {
          this.broadcast.emitWinner(this.server, roomCode, gs);
        }
      }
    }
  }
}
