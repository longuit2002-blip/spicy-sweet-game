import { Injectable } from "@nestjs/common";
import type { GameState } from "@sweet-spicy/shared-types";
import { computePlayerFinalScore, toClientGameState } from "@sweet-spicy/game-logic";
import type { RealtimeServer } from "../realtime/realtime-socket.types";

@Injectable()
export class GameBroadcastService {
  emitStateUpdate(server: RealtimeServer, roomCode: string, gs: GameState): void {
    void server.in(roomCode).fetchSockets().then((sockets) => {
      for (const s of sockets) {
        const uid = s.data.userId;
        if (!uid) continue;
        s.emit("game:state-update", toClientGameState(gs, uid));
      }
    });
  }

  emitGameStart(server: RealtimeServer, roomCode: string, gs: GameState): void {
    void server.in(roomCode).fetchSockets().then((sockets) => {
      for (const s of sockets) {
        const uid = s.data.userId;
        if (!uid) continue;
        s.emit("room:game-start", toClientGameState(gs, uid));
      }
    });
  }

  emitWinner(server: RealtimeServer, roomCode: string, gs: GameState): void {
    const scores = gs.players.map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      score: computePlayerFinalScore(p),
    }));
    void server.in(roomCode).fetchSockets().then((sockets) => {
      for (const s of sockets) {
        const uid = s.data.userId;
        if (!uid) continue;
        const client = toClientGameState(gs, uid);
        s.emit("game:winner", {
          winner: client.winner,
          winners: client.winners,
          scores,
        });
      }
    });
  }
}
