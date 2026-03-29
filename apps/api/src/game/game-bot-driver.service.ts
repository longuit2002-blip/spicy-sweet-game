import { Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import type { Server } from "socket.io";
import { applyBotChallengePhaseStep, applyBotPlayerTurnIfCurrentIsBot } from "@sweet-spicy/game-logic";
import { GAME_PHASE } from "@sweet-spicy/shared-types";
import { RoomService } from "../room/room.service";
import { BOT_DRIVER_TICK_MS } from "./game-loop.constants";
import { GameBroadcastService } from "./game-broadcast.service";

@Injectable()
export class GameBotDriverService {
  private server: Server | null = null;

  constructor(
    private readonly roomService: RoomService,
    private readonly broadcast: GameBroadcastService,
  ) {}

  attachServer(server: Server) {
    this.server = server;
  }

  @Interval(BOT_DRIVER_TICK_MS)
  tick() {
    if (!this.server) return;

    for (const [roomCode, room] of this.roomService.rooms) {
      if (room.status !== "IN_PROGRESS" || !room.gameState) continue;
      const gs = room.gameState;

      if (gs.phase === GAME_PHASE.END_GAME) continue;

      if (gs.phase === GAME_PHASE.PLAYER_TURN) {
        const next = applyBotPlayerTurnIfCurrentIsBot(gs);
        if (next) {
          room.gameState = next;
          this.roomService.syncRoomPlayersFromGame(room);
          this.broadcast.emitStateUpdate(this.server, roomCode, next);
        }
        continue;
      }

      if (gs.phase === GAME_PHASE.CHALLENGE_PHASE) {
        const next = applyBotChallengePhaseStep(gs);
        if (next) {
          room.gameState = next;
          this.roomService.syncRoomPlayersFromGame(room);
          this.broadcast.emitStateUpdate(this.server, roomCode, next);
          if (next.challengeResult) {
            this.server.to(roomCode).emit("game:challenge-result", next.challengeResult);
          }
        }
      }
    }
  }
}
