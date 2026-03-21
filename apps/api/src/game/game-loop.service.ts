import { Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import type { Server } from "socket.io";
import { acceptDeclaration, applyPenalty, nextTurn } from "@sweet-spicy/game-logic";
import type { GameState } from "@sweet-spicy/shared-types";
import type { ServerRoom } from "../room/room.service";
import { RoomService } from "../room/room.service";

@Injectable()
export class GameLoopService {
  private server: Server | null = null;

  constructor(private readonly roomService: RoomService) {}

  attachServer(server: Server) {
    this.server = server;
  }

  @Interval(1000)
  tick() {
    if (!this.server) return;

    for (const [roomCode, room] of this.roomService.rooms) {
      if (!room.gameState) continue;
      let gs: GameState = room.gameState;

      if (gs.phase === "CHALLENGE_PHASE") {
        const nextTimer = Math.max(0, gs.challengeTimer - 1);
        gs = { ...gs, challengeTimer: nextTimer };
        if (nextTimer <= 0) {
          gs = acceptDeclaration(gs);
        }
        room.gameState = gs;
        this.syncRoomPlayersFromGame(room);
        this.server.to(roomCode).emit("game:state-update", gs);
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
        this.server.to(roomCode).emit("game:state-update", gs);
        continue;
      }

      if (gs.phase === "PENALTY" || gs.phase === "NEXT_TURN") {
        const nextTimer = Math.max(0, gs.challengeTimer - 1);
        gs = { ...gs, challengeTimer: nextTimer };
        if (nextTimer <= 0) {
          gs = nextTurn(gs);
        }
        room.gameState = gs;
        this.syncRoomPlayersFromGame(room);
        this.server.to(roomCode).emit("game:state-update", gs);
        if (gs.phase === "END_GAME" && gs.winner) {
          const scores = gs.players.map((p) => ({
            playerId: p.id,
            nickname: p.nickname,
            score: p.score,
          }));
          this.server.to(roomCode).emit("game:winner", { winner: gs.winner, scores });
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
      score: gp.score,
      hand: gp.hand,
      successfulBluffs: gp.successfulBluffs,
      successfulChallenges: gp.successfulChallenges,
    }));
  }
}
