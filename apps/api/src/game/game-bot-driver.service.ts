import { Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { applyBotChallengePhaseStep, applyBotPlayerTurnIfCurrentIsBot } from "@sweet-spicy/game-logic";
import { GAME_PHASE } from "@sweet-spicy/shared-types";
import { BOT_DRIVER_TICK_MS } from "./game-loop.constants";
import { GameBroadcastService } from "./game-broadcast.service";
import type { RealtimeServer } from "../realtime/realtime-socket.types";
import { RoomRepository } from "../room/room.repository";
import { RoomService } from "../room/room.service";

@Injectable()
export class GameBotDriverService {
  private server: RealtimeServer | null = null;

  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly roomService: RoomService,
    private readonly broadcast: GameBroadcastService,
  ) {}

  attachServer(server: RealtimeServer) {
    this.server = server;
  }

  @Interval(BOT_DRIVER_TICK_MS)
  async tick() {
    if (!this.server) return;

    for (const [roomCode, room] of await this.roomRepository.getRoomEntries()) {
      if (room.status !== "IN_PROGRESS" || !room.gameState) continue;
      const gs = room.gameState;

      if (gs.phase === GAME_PHASE.END_GAME) continue;

      if (gs.phase === GAME_PHASE.PLAYER_TURN) {
        const next = applyBotPlayerTurnIfCurrentIsBot(gs);
        if (next) {
          room.gameState = next;
          await this.roomService.syncRoomPlayersFromGame(room);
          this.broadcast.emitStateUpdate(this.server, roomCode, next);
        }
        continue;
      }

      if (gs.phase === GAME_PHASE.CHALLENGE_PHASE) {
        const next = applyBotChallengePhaseStep(gs);
        if (next) {
          room.gameState = next;
          await this.roomService.syncRoomPlayersFromGame(room);
          this.broadcast.emitStateUpdate(this.server, roomCode, next);
          if (next.challengeResult) {
            this.server.to(roomCode).emit("game:challenge-result", next.challengeResult);
          }
        }
      }
    }
  }
}
