/** Stable codes for `socket.emit("error", { code, message })` from the API. */
export const SOCKET_ERROR_CODE = {
  RATE_LIMIT: "RATE_LIMIT",
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  START_FAILED: "START_FAILED",
  INVALID_MOVE: "INVALID_MOVE",
  INVALID_PHASE: "INVALID_PHASE",
  CANNOT_CHALLENGE_SELF: "CANNOT_CHALLENGE_SELF",
  CANNOT_ACCEPT_SELF: "CANNOT_ACCEPT_SELF",
  ADD_BOT_NOT_ALLOWED: "ADD_BOT_NOT_ALLOWED",
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_IN_PROGRESS: "ROOM_IN_PROGRESS",
  ROOM_FULL: "ROOM_FULL",
  ALREADY_IN_ROOM: "ALREADY_IN_ROOM",
  NOT_IN_ROOM: "NOT_IN_ROOM",
  HOST_ONLY: "HOST_ONLY",
  MIN_PLAYERS_NOT_MET: "MIN_PLAYERS_NOT_MET",
  ALL_PLAYERS_NOT_READY: "ALL_PLAYERS_NOT_READY",
} as const;

export type SocketErrorCode = (typeof SOCKET_ERROR_CODE)[keyof typeof SOCKET_ERROR_CODE];

export const SOCKET_ERROR_MESSAGE = {
  [SOCKET_ERROR_CODE.RATE_LIMIT]: "Too many requests",
  [SOCKET_ERROR_CODE.INVALID_PAYLOAD]: "Invalid payload",
  [SOCKET_ERROR_CODE.INVALID_MOVE]: "Cannot play this card",
  [SOCKET_ERROR_CODE.INVALID_PHASE]: "Action not allowed in this phase",
  [SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF]: "Cannot challenge yourself",
  [SOCKET_ERROR_CODE.CANNOT_ACCEPT_SELF]: "Cannot accept your own declaration",
  [SOCKET_ERROR_CODE.ADD_BOT_NOT_ALLOWED]: "Cannot add a bot right now",
  [SOCKET_ERROR_CODE.ROOM_NOT_FOUND]: "Room not found",
  [SOCKET_ERROR_CODE.ROOM_IN_PROGRESS]: "Game already in progress",
  [SOCKET_ERROR_CODE.ROOM_FULL]: "Room is full",
  [SOCKET_ERROR_CODE.ALREADY_IN_ROOM]: "Already in this room",
  [SOCKET_ERROR_CODE.NOT_IN_ROOM]: "Not in a room",
  [SOCKET_ERROR_CODE.HOST_ONLY]: "Only the host can do this",
  [SOCKET_ERROR_CODE.MIN_PLAYERS_NOT_MET]: "Need at least 2 players",
  [SOCKET_ERROR_CODE.ALL_PLAYERS_NOT_READY]: "All players must be ready",
} as const satisfies Partial<Record<SocketErrorCode, string>>;

/** Extra user-facing strings for specific `INVALID_PAYLOAD` / phase cases. */
export const SOCKET_ERROR_DETAIL_MESSAGE = {
  INVALID_ROOM_CODE: "Invalid room code",
  READY_NOT_BOOLEAN: "ready must be a boolean",
  READY_WRONG_PHASE: "Ready is only allowed in the lobby",
  CHALLENGE_WRONG_PHASE: "Challenge is only allowed during challenge phase",
  ACCEPT_WRONG_PHASE: "Accept is only allowed during challenge phase",
  CHALLENGE_NOT_AVAILABLE: "Cannot claim challenge now",
  CHALLENGE_PICK_NOT_ALLOWED: "Only the challenge holder can pick suit or number",
  ACCEPT_DURING_PICK_NOT_ALLOWED:
    "Cannot accept or pass now — the challenger is choosing suit or number",
  TOO_MANY_MESSAGES: "Too many messages",
  ADD_BOT_NOT_HOST: "Only the host can add bots",
  ADD_BOT_ROOM_FULL: "Room is full",
  ADD_BOT_WRONG_PHASE: "Bots can only be added in the lobby",
} as const;
