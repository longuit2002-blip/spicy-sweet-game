/** Default max players when creating a room (must stay within API DTO min/max). */
export const DEFAULT_ROOM_MAX_PLAYERS = 6;

/** Minimum seated players required to start a match (host action). */
export const MIN_PLAYERS_TO_START = 2;

/** Normalized join payload length (after trim / upper-case). */
export const ROOM_CODE_MIN_LENGTH = 4;
export const ROOM_CODE_MAX_LENGTH = 8;

/** Server game loop interval; offline client timers should match. */
export const GAME_SERVER_TICK_INTERVAL_MS = 1000;
