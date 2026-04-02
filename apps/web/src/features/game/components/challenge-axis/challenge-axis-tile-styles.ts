import { cn } from "@/lib/utils";

/** Standalone / modal pick (non-embedded). */
export const CHALLENGE_AXIS_TILE_ICON_SIZE = 48;

/** Embedded playfield strip. */
export const CHALLENGE_AXIS_TILE_ICON_SIZE_PLAYFIELD = 36;

/**
 * Embedded tile — modest radius + visible border so columns read as separate targets.
 */
const CHALLENGE_AXIS_TILE_BOX_EMBEDDED_CLASS = cn(
  "flex min-h-[2.75rem] w-full flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-center",
  "transition-[background-color,box-shadow,transform,border-color] duration-200 ease-out sm:min-h-[3rem] sm:gap-1.5 sm:px-2.5 sm:py-2.5",
);

/** Tappable / chosen axis (REVEAL lock emphasis, high-contrast). */
export const CHALLENGE_AXIS_TILE_ACTIVE_CLASS = cn(
  CHALLENGE_AXIS_TILE_BOX_EMBEDDED_CLASS,
  "border border-primary/40 bg-primary/10 text-foreground shadow-sm",
);

/**
 * PICK holder — card-like surface so two side-by-side targets do not read as one solid primary slab.
 */
export const CHALLENGE_AXIS_TILE_ACTIVE_PICK_MUTED_CLASS = cn(
  CHALLENGE_AXIS_TILE_BOX_EMBEDDED_CLASS,
  "border border-border/65 bg-card text-foreground shadow-sm ring-1 ring-border/25",
);

/** Ghost / inactive axis. */
export const CHALLENGE_AXIS_TILE_INACTIVE_CLASS = cn(
  CHALLENGE_AXIS_TILE_BOX_EMBEDDED_CLASS,
  "border border-dashed border-muted-foreground/45 bg-muted/30 text-muted-foreground",
);

/** Spectator ghost — pointer-events none + slight mute. */
export const CHALLENGE_AXIS_TILE_SPECTATOR_WRAP_CLASS =
  "pointer-events-none h-full opacity-[0.55] saturate-50";

/** REVEAL lock inactive column (still in DOM for layout). */
export const CHALLENGE_AXIS_TILE_REVEAL_INACTIVE_WRAP_CLASS = "h-full opacity-[0.55] saturate-50";

export const CHALLENGE_AXIS_TILE_LABEL_PRIMARY_CLASS =
  "line-clamp-2 font-headline text-[11px] font-bold leading-snug text-foreground sm:text-xs";

export const CHALLENGE_AXIS_TILE_LABEL_MUTED_CLASS =
  "line-clamp-2 font-headline text-[11px] font-bold leading-snug text-muted-foreground sm:text-xs";

/** Two equal columns; always horizontal above the timer. */
export const CHALLENGE_AXIS_TILE_ROW_CLASS =
  "flex w-full min-h-0 flex-1 flex-row items-stretch gap-2 sm:gap-2.5";

export const CHALLENGE_AXIS_TILE_COL_CLASS = "flex min-h-0 min-w-0 flex-1 basis-0 flex-col";

/**
 * Playfield strip outer — aligns with board max width.
 */
export const CHALLENGE_AXIS_PLAYFIELD_STRIP_OUTER_CLASS =
  "mx-auto flex w-full max-w-lg shrink-0 flex-col items-center pt-1.5 sm:max-w-xl sm:pt-2 lg:max-w-2xl";

/**
 * Fixed-height band for embedded PICK + {@link PlayfieldRevealActionStrip} (lock + flip).
 * Countdown lives in {@link ChallengerAxisIdentityStrip} — height budget is tiles + identity row only.
 */
export const CHALLENGE_AXIS_PLAYFIELD_STRIP_INNER_FIXED_CLASS =
  "mx-auto flex h-[11.5rem] max-h-[11.5rem] min-h-[11.5rem] w-full max-w-[min(100%,26rem)] shrink-0 flex-col overflow-hidden sm:h-[12.5rem] sm:max-h-[12.5rem] sm:min-h-[12.5rem] sm:max-w-[min(100%,28rem)]";
