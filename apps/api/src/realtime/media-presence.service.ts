import { Injectable } from "@nestjs/common";
import {
  SOCKET_ERROR_CODE,
  SOCKET_ERROR_MESSAGE,
  type MediaParticipant,
  type SocketErrorCode,
} from "@sweet-spicy/shared-types";
import type { ServerRoom } from "../room/room.service";

interface MediaPresenceEntry extends MediaParticipant {
  roomCode: string;
  userId: string;
  socketId: string;
}

interface MediaPresenceFailure {
  ok: false;
  code: SocketErrorCode;
  message: string;
}

interface MediaPresenceSuccess {
  ok: true;
  joined: boolean;
  selfPeerId: string;
  participant: MediaParticipant;
  participants: MediaParticipant[];
}

@Injectable()
export class MediaPresenceService {
  private readonly participantsByRoom = new Map<string, Map<string, MediaPresenceEntry>>();
  private readonly socketToPresence = new Map<string, { roomCode: string; userId: string }>();

  joinRoom(args: {
    room: ServerRoom;
    userId: string;
    socketId: string;
    audioEnabled: boolean;
    videoEnabled: boolean;
    activeSocketIds: ReadonlySet<string>;
  }): MediaPresenceSuccess | MediaPresenceFailure {
    const roomCode = args.room.roomCode.toUpperCase();
    const player = args.room.players.find((roomPlayer) => roomPlayer.id === args.userId);

    if (!player) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.NOT_IN_ROOM,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM],
      };
    }

    if (player.isBot) {
      return {
        ok: false,
        code: SOCKET_ERROR_CODE.MEDIA_BOTS_NOT_SUPPORTED,
        message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_BOTS_NOT_SUPPORTED],
      };
    }

    const roomEntries = this.participantsByRoom.get(roomCode) ?? new Map<string, MediaPresenceEntry>();
    const existingEntry = roomEntries.get(args.userId);

    if (existingEntry && existingEntry.socketId !== args.socketId) {
      if (args.activeSocketIds.has(existingEntry.socketId)) {
        return {
          ok: false,
          code: SOCKET_ERROR_CODE.MEDIA_ALREADY_ACTIVE_IN_ANOTHER_TAB,
          message: SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_ALREADY_ACTIVE_IN_ANOTHER_TAB],
        };
      }

      this.socketToPresence.delete(existingEntry.socketId);
    }

    const nextEntry: MediaPresenceEntry = {
      roomCode,
      userId: args.userId,
      socketId: args.socketId,
      peerId: args.userId,
      nickname: player.nickname,
      isHost: player.isHost,
      audioEnabled: args.audioEnabled,
      videoEnabled: args.videoEnabled,
    };

    roomEntries.set(args.userId, nextEntry);
    this.participantsByRoom.set(roomCode, roomEntries);
    this.socketToPresence.set(args.socketId, { roomCode, userId: args.userId });

    return {
      ok: true,
      joined: !existingEntry || existingEntry.socketId !== args.socketId,
      selfPeerId: args.userId,
      participant: this.toParticipant(nextEntry),
      participants: this.listParticipants(args.room, args.userId),
    };
  }

  updateMediaState(
    room: ServerRoom,
    userId: string,
    state: { audioEnabled: boolean; videoEnabled: boolean },
  ): MediaParticipant | null {
    const roomEntries = this.participantsByRoom.get(room.roomCode.toUpperCase());
    const existingEntry = roomEntries?.get(userId);
    const player = room.players.find((roomPlayer) => roomPlayer.id === userId);

    if (!roomEntries || !existingEntry || !player) {
      return null;
    }

    const nextEntry: MediaPresenceEntry = {
      ...existingEntry,
      nickname: player.nickname,
      isHost: player.isHost,
      audioEnabled: state.audioEnabled,
      videoEnabled: state.videoEnabled,
    };

    roomEntries.set(userId, nextEntry);
    return this.toParticipant(nextEntry);
  }

  leaveRoom(roomCode: string, userId: string): MediaParticipant | null {
    const normalizedRoomCode = roomCode.toUpperCase();
    const roomEntries = this.participantsByRoom.get(normalizedRoomCode);
    const existingEntry = roomEntries?.get(userId);

    if (!roomEntries || !existingEntry) {
      return null;
    }

    roomEntries.delete(userId);
    this.socketToPresence.delete(existingEntry.socketId);
    if (roomEntries.size === 0) {
      this.participantsByRoom.delete(normalizedRoomCode);
    }

    return this.toParticipant(existingEntry);
  }

  leaveBySocket(socketId: string): MediaParticipant | null {
    const presence = this.socketToPresence.get(socketId);
    if (!presence) {
      return null;
    }

    return this.leaveRoom(presence.roomCode, presence.userId);
  }

  getParticipant(roomCode: string, peerId: string): MediaParticipant | null {
    const roomEntries = this.participantsByRoom.get(roomCode.toUpperCase());
    const participant = roomEntries?.get(peerId);
    return participant ? this.toParticipant(participant) : null;
  }

  getParticipantSocketId(roomCode: string, peerId: string): string | null {
    const roomEntries = this.participantsByRoom.get(roomCode.toUpperCase());
    return roomEntries?.get(peerId)?.socketId ?? null;
  }

  getRoomCodeForSocket(socketId: string): string | null {
    return this.socketToPresence.get(socketId)?.roomCode ?? null;
  }

  listParticipants(room: ServerRoom, excludePeerId?: string): MediaParticipant[] {
    const roomEntries = this.participantsByRoom.get(room.roomCode.toUpperCase());
    if (!roomEntries) {
      return [];
    }

    return room.players.flatMap((roomPlayer) => {
      const entry = roomEntries.get(roomPlayer.id);
      if (!entry) {
        return [];
      }

      if (excludePeerId && entry.peerId === excludePeerId) {
        return [];
      }

      return [
        this.toParticipant({
          ...entry,
          nickname: roomPlayer.nickname,
          isHost: roomPlayer.isHost,
        }),
      ];
    });
  }

  private toParticipant(entry: MediaPresenceEntry): MediaParticipant {
    return {
      peerId: entry.peerId,
      nickname: entry.nickname,
      isHost: entry.isHost,
      audioEnabled: entry.audioEnabled,
      videoEnabled: entry.videoEnabled,
    };
  }
}
