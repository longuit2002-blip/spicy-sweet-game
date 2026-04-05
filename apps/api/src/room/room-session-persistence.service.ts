import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { computePlayerFinalScore } from "@sweet-spicy/game-logic";
import { PrismaService } from "../prisma/prisma.service";
import type { ServerRoom } from "./room.service";

interface PersistedRoomPlayer {
  id: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
  wonPileCount: number;
  trophyCount: number;
  isBot?: boolean;
}

@Injectable()
export class RoomSessionPersistenceService {
  private readonly logger = new Logger(RoomSessionPersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  persistRoomSnapshot(room: ServerRoom): void {
    const roomSnapshot = this.toRoomSnapshot(room);
    void this.prisma.roomSessionSnapshot.upsert({
      where: { roomCode: room.roomCode },
      update: roomSnapshot,
      create: roomSnapshot,
    }).catch((error: unknown) => {
      this.logger.error(`Failed to persist room snapshot for ${room.roomCode}`, error);
    });
  }

  deleteRoomSnapshot(roomCode: string): void {
    void this.prisma.roomSessionSnapshot.delete({
      where: { roomCode },
    }).catch((error: unknown) => {
      this.logger.error(`Failed to delete room snapshot for ${roomCode}`, error);
    });
  }

  persistMatchSummary(room: ServerRoom): void {
    if (!room.gameState || !room.startedAt || room.finishedAt == null) {
      return;
    }

    const durationSeconds = Math.max(
      0,
      Math.round((room.finishedAt.getTime() - room.startedAt.getTime()) / 1000),
    );

    void this.prisma.matchSummary.upsert({
      where: { id: `${room.roomCode}:${room.startedAt.getTime()}` },
      update: {
        finishedAt: room.finishedAt,
        durationSeconds,
        winnerIds: room.gameState.winners.map((player) => player.id),
        summary: this.toMatchSummary(room, durationSeconds),
      },
      create: {
        id: `${room.roomCode}:${room.startedAt.getTime()}`,
        roomCode: room.roomCode,
        startedAt: room.startedAt,
        finishedAt: room.finishedAt,
        playerCount: room.gameState.players.length,
        durationSeconds,
        winnerIds: room.gameState.winners.map((player) => player.id),
        summary: this.toMatchSummary(room, durationSeconds),
      },
    }).catch((error: unknown) => {
      this.logger.error(`Failed to persist match summary for ${room.roomCode}`, error);
    });
  }

  private toRoomSnapshot(room: ServerRoom) {
    return {
      roomCode: room.roomCode,
      hostId: room.hostId,
      status: room.status,
      maxPlayers: room.maxPlayers,
      startedAt: room.startedAt,
      finishedAt: room.finishedAt,
      createdAt: room.createdAt,
      roomState: {
        roomCode: room.roomCode,
        hostId: room.hostId,
        status: room.status,
        maxPlayers: room.maxPlayers,
        createdAt: room.createdAt.toISOString(),
        startedAt: room.startedAt?.toISOString() ?? null,
        finishedAt: room.finishedAt?.toISOString() ?? null,
        players: room.players.map((player) => this.toPersistedPlayer(player)),
      } as unknown as Prisma.InputJsonValue,
      gameState: (room.gameState ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
    };
  }

  private toMatchSummary(room: ServerRoom, durationSeconds: number) {
    const gameState = room.gameState;
    if (!gameState) {
      return Prisma.JsonNull;
    }

    return {
      roomCode: room.roomCode,
      startedAt: room.startedAt?.toISOString() ?? null,
      finishedAt: room.finishedAt?.toISOString() ?? null,
      durationSeconds,
      winners: gameState.winners.map((player) => ({
        id: player.id,
        nickname: player.nickname,
        score: computePlayerFinalScore(player),
      })),
      players: gameState.players.map((player) => ({
        id: player.id,
        nickname: player.nickname,
        score: computePlayerFinalScore(player),
        trophyCount: player.trophyCount,
        wonPileCount: player.wonPile.length,
        handCount: player.hand.length,
        isBot: player.isBot === true,
      })),
    } as Prisma.InputJsonValue;
  }

  private toPersistedPlayer(player: ServerRoom["players"][number]): PersistedRoomPlayer {
    return {
      id: player.id,
      nickname: player.nickname,
      isHost: player.isHost,
      isReady: player.isReady,
      score: player.score,
      wonPileCount: player.wonPileCount ?? 0,
      trophyCount: player.trophyCount ?? 0,
      ...(player.isBot ? { isBot: true } : {}),
    };
  }
}
