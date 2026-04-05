import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AccessToken } from "livekit-server-sdk";
import type { MediaTokenResponse } from "@sweet-spicy/shared-types";
import { RoomService } from "../room/room.service";

@Injectable()
export class MediaService {
  constructor(private readonly roomService: RoomService) {}

  async issueToken(
    userId: string,
    fallbackNickname: string,
    roomCodeInput: string,
  ): Promise<MediaTokenResponse> {
    const roomCode = roomCodeInput.trim().toUpperCase();
    const room = await this.roomService.getRoomByCode(roomCode);
    if (!room) {
      throw new NotFoundException("Room not found");
    }

    const player = room.players.find((roomPlayer) => roomPlayer.id === userId);
    if (!player) {
      throw new ForbiddenException("You are not a member of this room");
    }
    if (player.isBot) {
      throw new ForbiddenException("Bots cannot receive media tokens");
    }

    const livekitUrl = process.env.LIVEKIT_URL?.trim();
    const livekitApiKey = process.env.LIVEKIT_API_KEY?.trim();
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET?.trim();
    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      throw new ServiceUnavailableException("Media service is not configured");
    }

    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: userId,
      name: player.nickname || fallbackNickname,
      ttl: "15m",
    });
    token.addGrant({
      roomJoin: true,
      room: roomCode,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return {
      livekitUrl,
      token: await token.toJwt(),
      roomCode,
      participantIdentity: userId,
      participantName: player.nickname || fallbackNickname,
    };
  }
}
