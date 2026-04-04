import type { SocketErrorCode } from "./socket-error-codes.js";

export type MediaSessionDescriptionType = "answer" | "offer" | "pranswer" | "rollback";

export interface MediaIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface MediaSessionDescription {
  type: MediaSessionDescriptionType;
  sdp?: string;
}

export interface MediaIceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface MediaTrackState {
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface MediaParticipant extends MediaTrackState {
  peerId: string;
  nickname: string;
  isHost: boolean;
}

export interface MediaJoinRoomData extends MediaTrackState {
  roomCode?: string;
}

export type MediaJoinRoomResult =
  | {
      success: true;
      selfPeerId: string;
      participants: MediaParticipant[];
      iceServers: MediaIceServer[];
    }
  | {
      success: false;
      code: SocketErrorCode;
      message: string;
    };

export interface MediaSignalOffer {
  targetPeerId: string;
  offer: MediaSessionDescription;
}

export interface MediaSignalAnswer {
  targetPeerId: string;
  answer: MediaSessionDescription;
}

export interface MediaSignalIceCandidate {
  targetPeerId: string;
  candidate: MediaIceCandidate;
}

export interface MediaIncomingOffer {
  fromPeerId: string;
  offer: MediaSessionDescription;
}

export interface MediaIncomingAnswer {
  fromPeerId: string;
  answer: MediaSessionDescription;
}

export interface MediaIncomingIceCandidate {
  fromPeerId: string;
  candidate: MediaIceCandidate;
}

export interface MediaPeerJoinedEvent {
  participant: MediaParticipant;
}

export interface MediaPeerLeftEvent {
  peerId: string;
}

export interface MediaPeerStateEvent extends MediaTrackState {
  peerId: string;
}
