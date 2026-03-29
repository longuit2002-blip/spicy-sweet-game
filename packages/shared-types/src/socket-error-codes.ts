/** Stable codes for `socket.emit("error", { code, message })` from the API. */
export const SOCKET_ERROR_CODE = {
  RATE_LIMIT: "RATE_LIMIT",
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  START_FAILED: "START_FAILED",
  INVALID_MOVE: "INVALID_MOVE",
  INVALID_PHASE: "INVALID_PHASE",
  CANNOT_CHALLENGE_SELF: "CANNOT_CHALLENGE_SELF",
  ADD_BOT_NOT_ALLOWED: "ADD_BOT_NOT_ALLOWED",
} as const;

export type SocketErrorCode = (typeof SOCKET_ERROR_CODE)[keyof typeof SOCKET_ERROR_CODE];

export const SOCKET_ERROR_MESSAGE = {
  [SOCKET_ERROR_CODE.RATE_LIMIT]: "Too many requests",
  [SOCKET_ERROR_CODE.INVALID_PAYLOAD]: "Invalid payload",
  [SOCKET_ERROR_CODE.INVALID_MOVE]: "Cannot play this card",
  [SOCKET_ERROR_CODE.INVALID_PHASE]: "Action not allowed in this phase",
  [SOCKET_ERROR_CODE.CANNOT_CHALLENGE_SELF]: "Cannot challenge yourself",
  [SOCKET_ERROR_CODE.ADD_BOT_NOT_ALLOWED]: "Cannot add a bot right now",
} as const satisfies Partial<Record<SocketErrorCode, string>>;

/** Extra user-facing strings for specific `INVALID_PAYLOAD` / phase cases. */
export const SOCKET_ERROR_DETAIL_MESSAGE = {
  INVALID_ROOM_CODE: "Invalid room code",
  READY_NOT_BOOLEAN: "ready must be a boolean",
  CHALLENGE_WRONG_PHASE: "Challenge is only allowed during challenge phase",
  ACCEPT_WRONG_PHASE: "Accept is only allowed during challenge phase",
  TOO_MANY_MESSAGES: "Too many messages",
  ADD_BOT_NOT_HOST: "Only the host can add bots",
  ADD_BOT_ROOM_FULL: "Room is full",
  ADD_BOT_WRONG_PHASE: "Bots can only be added in the lobby",
} as const;
