import { Injectable } from "@nestjs/common";
import {
  REDIS_ACTIVE_ROOMS_SET_KEY,
  REDIS_FINISHED_ROOM_TTL_SECONDS,
  REDIS_ROOM_KEY_PREFIX,
  REDIS_USER_ROOM_KEY_PREFIX,
  REDIS_WAITING_ROOM_TTL_SECONDS,
} from "../redis/redis.constants";
import { RedisService } from "../redis/redis.service";
import type { ServerRoom } from "./room.service";

@Injectable()
export class RoomRepository {
  private readonly roomsByCode = new Map<string, ServerRoom>();
  private readonly roomCodeByUserId = new Map<string, string>();

  constructor(private readonly redis: RedisService) {}

  async getRoomEntries(): Promise<Array<[string, ServerRoom]>> {
    if (!this.redis.isAvailable()) {
      return Array.from(this.roomsByCode.entries());
    }

    const activeCodes = await this.redis.sMembers(REDIS_ACTIVE_ROOMS_SET_KEY);
    if (activeCodes.length === 0) {
      return [];
    }

    const keys = activeCodes.map((roomCode) => this.roomKey(roomCode));
    const payloads = await this.redis.mGet(keys);
    const entries: Array<[string, ServerRoom]> = [];

    for (let index = 0; index < activeCodes.length; index += 1) {
      const payload = payloads[index];
      if (!payload) {
        continue;
      }

      const room = this.deserializeRoom(payload);
      const normalizedRoomCode = activeCodes[index].toUpperCase();
      this.roomsByCode.set(normalizedRoomCode, room);
      entries.push([normalizedRoomCode, room]);
    }

    return entries;
  }

  async getRoomByCode(roomCode: string): Promise<ServerRoom | undefined> {
    const normalizedRoomCode = roomCode.toUpperCase();
    if (!this.redis.isAvailable()) {
      return this.roomsByCode.get(normalizedRoomCode);
    }

    const payload = await this.redis.get(this.roomKey(normalizedRoomCode));
    if (!payload) {
      return undefined;
    }

    const room = this.deserializeRoom(payload);
    this.roomsByCode.set(normalizedRoomCode, room);
    return room;
  }

  async saveRoom(room: ServerRoom): Promise<void> {
    const normalizedRoomCode = room.roomCode.toUpperCase();
    room.roomCode = normalizedRoomCode;
    this.roomsByCode.set(normalizedRoomCode, room);

    if (!this.redis.isAvailable()) {
      return;
    }

    const serializedRoom = JSON.stringify(room);
    if (room.status === "WAITING") {
      await this.redis.setWithExpiry(
        this.roomKey(normalizedRoomCode),
        serializedRoom,
        REDIS_WAITING_ROOM_TTL_SECONDS,
      );
    } else if (room.status === "IN_PROGRESS") {
      await this.redis.set(this.roomKey(normalizedRoomCode), serializedRoom);
    } else {
      await this.redis.setWithExpiry(
        this.roomKey(normalizedRoomCode),
        serializedRoom,
        REDIS_FINISHED_ROOM_TTL_SECONDS,
      );
    }
    await this.redis.sAdd(REDIS_ACTIVE_ROOMS_SET_KEY, normalizedRoomCode);
  }

  async deleteRoom(roomCode: string): Promise<boolean> {
    const normalizedRoomCode = roomCode.toUpperCase();
    const didDelete = this.roomsByCode.delete(normalizedRoomCode);
    if (this.redis.isAvailable()) {
      await this.redis.del(this.roomKey(normalizedRoomCode));
      await this.redis.sRem(REDIS_ACTIVE_ROOMS_SET_KEY, normalizedRoomCode);
    }
    return didDelete;
  }

  async getRoomCodeForUser(userId: string): Promise<string | undefined> {
    if (!this.redis.isAvailable()) {
      return this.roomCodeByUserId.get(userId);
    }

    const roomCode = await this.redis.get(this.userRoomKey(userId));
    if (!roomCode) {
      return undefined;
    }

    const normalizedRoomCode = roomCode.toUpperCase();
    this.roomCodeByUserId.set(userId, normalizedRoomCode);
    return normalizedRoomCode;
  }

  async assignUserToRoom(userId: string, roomCode: string): Promise<void> {
    const normalizedRoomCode = roomCode.toUpperCase();
    this.roomCodeByUserId.set(userId, normalizedRoomCode);
    if (this.redis.isAvailable()) {
      await this.redis.set(this.userRoomKey(userId), normalizedRoomCode);
    }
  }

  async clearUserRoom(userId: string): Promise<void> {
    this.roomCodeByUserId.delete(userId);
    if (this.redis.isAvailable()) {
      await this.redis.del(this.userRoomKey(userId));
    }
  }

  async getRoomCount(): Promise<number> {
    if (this.redis.isAvailable()) {
      return this.redis.sCard(REDIS_ACTIVE_ROOMS_SET_KEY);
    }

    return this.roomsByCode.size;
  }

  private roomKey(roomCode: string): string {
    return `${REDIS_ROOM_KEY_PREFIX}${roomCode.toUpperCase()}`;
  }

  private userRoomKey(userId: string): string {
    return `${REDIS_USER_ROOM_KEY_PREFIX}${userId}`;
  }

  private deserializeRoom(payload: string): ServerRoom {
    const parsed = JSON.parse(payload) as Omit<ServerRoom, "createdAt" | "startedAt" | "finishedAt"> & {
      createdAt: string;
      startedAt: string | null;
      finishedAt: string | null;
    };

    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      startedAt: parsed.startedAt ? new Date(parsed.startedAt) : null,
      finishedAt: parsed.finishedAt ? new Date(parsed.finishedAt) : null,
    };
  }
}
