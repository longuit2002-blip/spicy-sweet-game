import type { ChallengeType, ClientGameState, Declaration, ChallengeResult } from "./game.js";
import type {
  RoomPlayer,
  RoomState,
  JoinResult,
  CreateRoomData,
  CreateRoomResult,
  AddLobbyBotResult,
  Score,
  SocketActionResult,
} from "./room.js";

export type {
  JoinResult,
  CreateRoomData,
  CreateRoomResult,
  AddLobbyBotResult,
  RoomState,
  RoomPlayer,
  SocketActionResult,
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

  error: (error: SocketError) => void;
}

/** Client → server Socket.IO events */
export interface ClientToServerEvents {
  "room:join": (roomCode: string, callback?: (result: JoinResult) => void) => void;
  "room:create": (data: CreateRoomData, callback?: (result: CreateRoomResult) => void) => void;
  "room:leave": (callback?: (result: SocketActionResult) => void) => void;
  "room:ready": (ready: boolean, callback?: (result: SocketActionResult) => void) => void;
  "room:start": (callback?: (result: SocketActionResult) => void) => void;
  "room:add-bot": (callback?: (result: AddLobbyBotResult) => void) => void;

  "game:play-card": (
    data: { cardId: string; declaration: Declaration },
    callback?: (result: SocketActionResult) => void,
  ) => void;
  /** Draw one from the main pile and skip declaration (authoritative server). */
  "game:draw-pass": (callback?: (result: SocketActionResult) => void) => void;
  "game:claim-challenge": (callback?: (result: SocketActionResult) => void) => void;
  "game:challenge": (
    data: { challengeType: ChallengeType },
    callback?: (result: SocketActionResult) => void,
  ) => void;
  "game:accept": (callback?: (result: SocketActionResult) => void) => void;
  /** Skip contesting the challenge during CLAIM_RACE; advances turn when all eligible players pass. */
  "game:challenge-pass": (callback?: (result: SocketActionResult) => void) => void;

  "chat:send": (data: { content: string }) => void;
}
