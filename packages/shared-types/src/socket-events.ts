import type { ChallengeType, ClientGameState, Declaration, ChallengeResult } from "./game.js";
import type {
  RoomPlayer,
  RoomState,
  JoinResult,
  CreateRoomData,
  CreateRoomResult,
  AddLobbyBotResult,
  Score,
} from "./room.js";

export type {
  JoinResult,
  CreateRoomData,
  CreateRoomResult,
  AddLobbyBotResult,
  RoomState,
  RoomPlayer,
};
import type { ChatMessage } from "./chat.js";
import type { SocketError } from "./auth.js";

/** Server → client Socket.IO events */
export interface ServerToClientEvents {
  "room:joined": (data: RoomState) => void;
  "room:player-joined": (player: RoomPlayer) => void;
  "room:player-left": (data: { playerId: string }) => void;
  "room:player-ready": (data: { playerId: string; ready: boolean }) => void;
  "room:game-start": (gameState: ClientGameState) => void;
  "room:host-changed": (data: { newHostId: string }) => void;

  "game:state-update": (gameState: ClientGameState) => void;
  "game:challenge-result": (result: ChallengeResult) => void;
  "game:winner": (data: {
    winner: import("./game.js").GamePlayer | null;
    winners: import("./game.js").GamePlayer[];
    scores: Score[];
  }) => void;
  "game:player-turn": (data: { playerId: string | undefined; timeLeft: number }) => void;

  "chat:message": (message: ChatMessage) => void;

  "webrtc:peer-joined": (data: { peerId: string }) => void;
  "webrtc:peer-left": (data: { peerId: string }) => void;
  "webrtc:offer": (data: { peerId: string; offer: RTCSessionDescriptionInit }) => void;
  "webrtc:answer": (data: { peerId: string; answer: RTCSessionDescriptionInit }) => void;
  "webrtc:ice-candidate": (data: { peerId: string; candidate: RTCIceCandidateInit }) => void;

  error: (error: SocketError) => void;
}

/** Client → server Socket.IO events */
export interface ClientToServerEvents {
  "room:join": (roomCode: string, callback?: (result: JoinResult) => void) => void;
  "room:create": (data: CreateRoomData, callback?: (result: CreateRoomResult) => void) => void;
  "room:leave": () => void;
  "room:ready": (ready: boolean) => void;
  "room:start": () => void;
  "room:add-bot": (callback?: (result: AddLobbyBotResult) => void) => void;

  "game:play-card": (data: { cardId: string; declaration: Declaration }) => void;
  /** Draw one from the main pile and skip declaration (authoritative server). */
  "game:draw-pass": () => void;
  "game:claim-challenge": () => void;
  "game:challenge": (data: { challengeType: ChallengeType }) => void;
  "game:accept": () => void;

  "chat:send": (data: { content: string }) => void;

  "webrtc:join-room": (roomCode?: string) => void;
  "webrtc:leave-room": () => void;
  "webrtc:offer": (data: { peerId: string; offer: RTCSessionDescriptionInit }) => void;
  "webrtc:answer": (data: { peerId: string; answer: RTCSessionDescriptionInit }) => void;
  "webrtc:ice-candidate": (data: { peerId: string; candidate: RTCIceCandidateInit }) => void;
}
