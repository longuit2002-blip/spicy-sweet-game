import { Injectable } from "@nestjs/common";
import type { ServerRoom } from "./room.service";

@Injectable()
export class RoomRepository {
  private readonly roomsByCode = new Map<string, ServerRoom>();
  private readonly roomCodeByUserId = new Map<string, string>();

  getRoomEntries(): IterableIterator<[string, ServerRoom]> {
    return this.roomsByCode.entries();
  }

  getRoomByCode(roomCode: string): ServerRoom | undefined {
    return this.roomsByCode.get(roomCode.toUpperCase());
  }

  saveRoom(room: ServerRoom): void {
    this.roomsByCode.set(room.roomCode, room);
  }

  deleteRoom(roomCode: string): boolean {
    return this.roomsByCode.delete(roomCode.toUpperCase());
  }

  getRoomCodeForUser(userId: string): string | undefined {
    return this.roomCodeByUserId.get(userId);
  }

  assignUserToRoom(userId: string, roomCode: string): void {
    this.roomCodeByUserId.set(userId, roomCode.toUpperCase());
  }

  clearUserRoom(userId: string): void {
    this.roomCodeByUserId.delete(userId);
  }

  getRoomCount(): number {
    return this.roomsByCode.size;
  }
}
