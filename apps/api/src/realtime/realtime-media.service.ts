import { Injectable } from "@nestjs/common";
import type {
  MediaSignalAnswer,
  MediaSignalIceCandidate,
  MediaSignalOffer,
  SocketActionResult,
} from "@sweet-spicy/shared-types";
import {
  SOCKET_ERROR_CODE,
  SOCKET_ERROR_MESSAGE,
} from "@sweet-spicy/shared-types";
import { MediaConfigService } from "./media-config.service";
import { MediaPresenceService } from "./media-presence.service";
import { failureResult, successResult } from "./realtime-action-result";
import { RealtimeSessionService } from "./realtime-session.service";
import type { RealtimeSocket } from "./realtime-socket.types";
import type { WebrtcJoinRoomDto } from "./dto/webrtc-join-room.dto";
import type { WebrtcMediaStateDto } from "./dto/webrtc-media-state.dto";

@Injectable()
export class RealtimeMediaService {
  constructor(
    private readonly session: RealtimeSessionService,
    private readonly mediaConfig: MediaConfigService,
    private readonly mediaPresence: MediaPresenceService,
  ) {}

  handleJoin(client: RealtimeSocket, data: WebrtcJoinRoomDto) {
    const userId = this.session.requireUserId(client);
    this.session.clearMediaDisconnectTimer(client.id);
    const room = this.session.getRoomForMediaAction(client, data.roomCode);
    if (!room) {
      return failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }

    const result = this.mediaPresence.joinRoom({
      room,
      userId,
      socketId: client.id,
      audioEnabled: data.audioEnabled,
      videoEnabled: data.videoEnabled,
      activeSocketIds: this.session.getActiveSocketIdsForUser(userId),
    });

    if (!result.ok) {
      return failureResult(result.code, result.message);
    }

    client.data.roomId = room.roomCode;
    if (result.joined) {
      client.to(room.roomCode).emit("webrtc:peer-joined", {
        participant: result.participant,
      });
    }

    return successResult({
      selfPeerId: result.selfPeerId,
      participants: result.participants,
      iceServers: this.mediaConfig.getIceServers(),
    });
  }

  handleLeave(client: RealtimeSocket): SocketActionResult {
    this.session.clearMediaDisconnectTimer(client.id);
    const roomCode =
      this.mediaPresence.getRoomCodeForSocket(client.id) ?? this.session.getResolvedRoomCode(client) ?? null;
    const participant = this.mediaPresence.leaveBySocket(client.id);
    if (!participant) {
      return successResult();
    }

    if (roomCode) {
      client.nsp.to(roomCode).emit("webrtc:peer-left", { peerId: participant.peerId });
    }
    return successResult();
  }

  handleUpdateMediaState(client: RealtimeSocket, data: WebrtcMediaStateDto): SocketActionResult {
    const room = this.session.getRoomForMediaAction(client);
    const userId = this.session.requireUserId(client);
    if (!room) {
      return failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }

    const participant = this.mediaPresence.updateMediaState(room, userId, data);
    if (!participant) {
      return failureResult(
        SOCKET_ERROR_CODE.MEDIA_NOT_JOINED,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_NOT_JOINED] as string,
      );
    }

    this.session.emitMediaState(room.roomCode, participant);
    return successResult();
  }

  handleOffer(client: RealtimeSocket, data: MediaSignalOffer): SocketActionResult {
    const room = this.session.getRoomForMediaAction(client);
    const userId = this.session.requireUserId(client);
    if (!room) {
      return failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }

    if (!this.mediaPresence.getParticipant(room.roomCode, userId)) {
      return failureResult(
        SOCKET_ERROR_CODE.MEDIA_NOT_JOINED,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_NOT_JOINED] as string,
      );
    }

    const didEmit = this.session.emitToMediaPeer(room.roomCode, data.targetPeerId, "webrtc:offer", {
      fromPeerId: userId,
      offer: data.offer,
    });
    if (!didEmit) {
      return failureResult(
        SOCKET_ERROR_CODE.MEDIA_PEER_NOT_FOUND,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_PEER_NOT_FOUND] as string,
      );
    }

    return successResult();
  }

  handleAnswer(client: RealtimeSocket, data: MediaSignalAnswer): SocketActionResult {
    const room = this.session.getRoomForMediaAction(client);
    const userId = this.session.requireUserId(client);
    if (!room) {
      return failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }

    if (!this.mediaPresence.getParticipant(room.roomCode, userId)) {
      return failureResult(
        SOCKET_ERROR_CODE.MEDIA_NOT_JOINED,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_NOT_JOINED] as string,
      );
    }

    const didEmit = this.session.emitToMediaPeer(room.roomCode, data.targetPeerId, "webrtc:answer", {
      fromPeerId: userId,
      answer: data.answer,
    });
    if (!didEmit) {
      return failureResult(
        SOCKET_ERROR_CODE.MEDIA_PEER_NOT_FOUND,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_PEER_NOT_FOUND] as string,
      );
    }

    return successResult();
  }

  handleIceCandidate(client: RealtimeSocket, data: MediaSignalIceCandidate): SocketActionResult {
    const room = this.session.getRoomForMediaAction(client);
    const userId = this.session.requireUserId(client);
    if (!room) {
      return failureResult(
        SOCKET_ERROR_CODE.NOT_IN_ROOM,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.NOT_IN_ROOM] as string,
      );
    }

    if (!this.mediaPresence.getParticipant(room.roomCode, userId)) {
      return failureResult(
        SOCKET_ERROR_CODE.MEDIA_NOT_JOINED,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_NOT_JOINED] as string,
      );
    }

    const didEmit = this.session.emitToMediaPeer(room.roomCode, data.targetPeerId, "webrtc:ice-candidate", {
      fromPeerId: userId,
      candidate: data.candidate,
    });
    if (!didEmit) {
      return failureResult(
        SOCKET_ERROR_CODE.MEDIA_PEER_NOT_FOUND,
        SOCKET_ERROR_MESSAGE[SOCKET_ERROR_CODE.MEDIA_PEER_NOT_FOUND] as string,
      );
    }

    return successResult();
  }
}
