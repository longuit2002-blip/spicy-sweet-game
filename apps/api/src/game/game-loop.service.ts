import { Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { GAME_LOOP_TICK_INTERVAL_MS } from "./game-loop.constants";
import type { Server } from "socket.io";
import { applyPenalty, computePlayerFinalScore, nextTurn, tickChallengePhase } from "@sweet-spicy/game-logic";
import type { GameState } from "@sweet-spicy/shared-types";
import type { ServerRoom } from "../room/room.service";
import { RoomService } from "../room/room.service";
import { GameBroadcastService } from "./game-broadcast.service";

@Injectable()
export class GameLoopService {
  private server: Server | null = null;

  constructor(
    private readonly roomService: RoomService,
    private readonly broadcast: GameBroadcastService,
  ) {}

  attachServer(server: Server) {
    this.server = server;
  }

  @Interval(GAME_LOOP_TICK_INTERVAL_MS)
  tick() {
    if (!this.server) return;

    for (const [roomCode, room] of this.roomService.rooms) {
      if (!room.gameState) continue;
      const prevPhase = room.gameState.phase;
      let gs: GameState = room.gameState;

      if (gs.phase === "CHALLENGE_PHASE") {
        gs = tickChallengePhase(gs);
        room.gameState = gs;
        this.syncRoomPlayersFromGame(room);
        this.broadcast.emitStateUpdate(this.server, roomCode, gs);
        if (prevPhase !== "END_GAME" && gs.phase === "END_GAME") {
          this.broadcast.emitWinner(this.server, roomCode, gs);
        }
        continue;
      }

      if (gs.phase === "REVEAL") {
        const nextTimer = Math.max(0, gs.challengeTimer - 1);
        gs = { ...gs, challengeTimer: nextTimer };
        if (nextTimer <= 0) {
          gs = applyPenalty(gs);
        }
        room.gameState = gs;
        this.syncRoomPlayersFromGame(room);
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
        this.syncRoomPlayersFromGame(room);
        this.broadcast.emitStateUpdate(this.server, roomCode, gs);
        if (prevPhase !== "END_GAME" && gs.phase === "END_GAME") {
          this.broadcast.emitWinner(this.server, roomCode, gs);
        }
      }
    }
  }

  private syncRoomPlayersFromGame(room: ServerRoom) {
    if (!room.gameState) return;
    room.players = room.gameState.players.map((gp) => ({
      id: gp.id,
      nickname: gp.nickname,
      isHost: room.hostId === gp.id,
      isReady: true,
      score: computePlayerFinalScore(gp),
      hand: gp.hand,
      wonPileCount: gp.wonPile.length,
      trophyCount: gp.trophyCount,
    }));
  }
}
