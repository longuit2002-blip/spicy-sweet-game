/**
 * Phase countdowns are in seconds and align with the API game loop tick (1s).
 * Keep UI and `@sweet-spicy/game-logic` in sync.
 */

/** Challenge / accept window after a play (server decrements once per second). */
export const CHALLENGE_PHASE_COUNTDOWN_SECONDS = 20;

/** Race to tap “claim challenge” in the center; first server-side claim wins. */
export const CHALLENGE_CLAIM_RACE_SECONDS = 20;

/** After a claim, holder must pick wrong suit vs wrong number. */
export const CHALLENGE_PICK_TYPE_SECONDS = 20;

/**
 * First seconds of `REVEAL`: choice is “locked” (suit vs number); clients keep the card face-down until `challengeTimer` crosses {@link REVEAL_REMAIN_AFTER_LOCK_THRESHOLD}.
 */
export const REVEAL_LOCK_COUNTDOWN_SECONDS = 3;

/**
 * After the lock window: time for the slow flip animation plus a short beat to read the face before penalty.
 * Sum of integer seconds should cover ~`PLAYFIELD_REVEAL_FLIP_DURATION_SECONDS` on the client plus dwell.
 */
export const REVEAL_POST_LOCK_HOLD_SECONDS = 8;

/** Initial `challengeTimer` entering `REVEAL` — lock segment + post-lock segment (server ticks once per second). */
export const REVEAL_PHASE_COUNTDOWN_SECONDS =
  REVEAL_LOCK_COUNTDOWN_SECONDS + REVEAL_POST_LOCK_HOLD_SECONDS;

/** While `challengeTimer` is strictly greater than this, all clients are in the lock window (`REVEAL_LOCK_COUNTDOWN_SECONDS` ticks). */
export const REVEAL_REMAIN_AFTER_LOCK_THRESHOLD =
  REVEAL_PHASE_COUNTDOWN_SECONDS - REVEAL_LOCK_COUNTDOWN_SECONDS;

/** Pause after PENALTY / NEXT_TURN / TROPHY before advancing — not used for the main REVEAL countdown. */
export const PHASE_STEP_PAUSE_SECONDS = 2;

/** Number of cards drawn as a failed-challenge penalty. */
export const PENALTY_DRAW_COUNT = 2;

/** Cards drawn when a player skips declaration and passes the turn ({@link drawAndPassTurn}). */
export const DRAW_PASS_TURN_CARD_COUNT = 1;

/** Default `challengeTimer` in LOBBY / idle states (not actively counting down). */
export const IDLE_CHALLENGE_TIMER_SECONDS = 0;

/** Spicy cards dealt from the main draw pile at `startGame`. */
export const INITIAL_HAND_SIZE = 5;

/** Hand size after claiming a trophy or winning with Total Wild. */
export const REFILL_HAND_SIZE = 5;

/** Opening declaration rank must be in 1..OPENING_RANK_MAX inclusive. */
export const OPENING_RANK_MAX = 3;

export const TROPHY_CARD_POINTS = 10;
export const WILD_CARD_POINTS = 5;
export const WILD_CARD_PENALTY = 5;
export const NORMAL_CARD_POINTS = 1;

export const TOTAL_TROPHIES = 3;
export const TOTAL_WILD_CARDS = 6;
export const WILD_SUIT_CARDS = 5;
export const WILD_NUMBER_CARDS = 5;
