import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useDndContext,
  useSensor,
  useSensors,
  pointerWithin,
} from "@dnd-kit/core";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MAX_DECLARATION_RANK, TOTAL_TROPHIES } from "@sweet-spicy/game-logic";
import type {
  ChallengeResult,
  ClientPlayedCard,
  Declaration,
  GamePhase,
  PlayedCard,
  SpiceType,
} from "@/shared/types/game";
import { GAME_PHASE, SPICE_EMOJI, SPICE_LABEL } from "@/shared/types/game";
import { CardBackSurface } from "@/features/game/components/CardBackSurface";
import { SpiceCard } from "@/features/game/components/SpiceCard";
import { PlayfieldDeclaredCardFlip } from "./PlayfieldDeclaredCardFlip";
import {
  GAME_CARD_ART_ASPECT_CLASS,
  SPICE_DECLARE_CONTEXT_RANK_CHIP_CLASS,
  SPICE_DECLARE_CONTEXT_SUIT_TEXT_CLASS,
  SPICE_DECLARE_CONTEXT_TRACK_CLASS,
  TABLEAU_TROPHY_DISPLAY_CARD,
} from "@/lib/game-card-assets";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PHASE_EASE_OUT,
  PLAY_CARD_TO_TABLE_SPRING,
  PLAYFIELD_CLAIM_ENTRANCE_INITIAL_SCALE,
  PLAYFIELD_CLAIM_ENTRANCE_OFFSET_Y_PX,
  PLAYFIELD_CLAIM_ENTRANCE_ROTATE_Z_DEG,
  SNAPPY_SPRING,
} from "@/features/game/animations";
import {
  DEFAULT_LOBBY_NICKNAME,
  DRAW_PASS_COACH_HINT_DISPLAY_MS,
  isRoundResolutionInterstitialPhase,
  REVEAL_REMAIN_AFTER_LOCK_THRESHOLD,
} from "@/lib/game-room.constants";
import {
  GAME_DND_DRAG_DRAW_PASS_ID,
  GAME_DND_DROP_PLAY_ZONE,
  GAME_DND_KIND,
  GAME_DND_POINTER_ACTIVATION_DISTANCE_PX,
  GAME_DND_DRAW_PASS_SOURCE_DIM_OPACITY,
  GAME_DND_TOUCH_ACTIVATION_DELAY_MS,
  GAME_DND_TOUCH_ACTIVATION_TOLERANCE_PX,
  isGameDndDeclareCardData,
  isGameDndDrawPassData,
  type GameDndDrawPassDragData,
} from "@/features/game/dnd/game-dnd-ids";

/** Drop a hand card onto the empty play slot (@dnd-kit). */
export type PlayDropZoneConfig = {
  highlighted: boolean;
  onCardDrop: (cardId: string) => void;
};

/** Draw one from the main pile and skip declaration (PLAYER_TURN only). */
export type DrawPassActionConfig = {
  onDrawPass: () => void;
};

/** Duel draw pile: drag stack toward local hand to draw-and-pass (`PLAYER_TURN` only). */
export type DrawPassPileDraggableConfig = {
  active: boolean;
  /**
   * Tap fallback — same action as dropping the pile on the hand.
   * Optional so non-interactive tableaux stay unchanged.
   */
  onDrawPass?: () => void;
};

export interface GameTableProps {
  playedCard: PlayedCard | ClientPlayedCard | null;
  currentPlayerName: string;
  phase: GamePhase;
  lastResolvedDeclaration: Declaration | null;
  lockedSuit: SpiceType | null;
  tablePileCount: number;
  /** Cards left in the main draw pile. */
  drawPileCount: number;
  /** Total Wild cards beside the draw pile (recovery pool). */
  supremeReserve: number;
  trophiesRemaining: number;
  /** When set and phase is `PLAYER_TURN` with no `playedCard`, center slot accepts drag-drop. */
  playDropZone?: PlayDropZoneConfig | null;
  /** Set during `REVEAL` — enriches claim card a11y label with outcome (visual is the flipped real card). */
  challengeResult?: ChallengeResult | null;
  /** Shown with {@link challengeResult} for inline outcome copy (REVEAL callout). */
  challengeOutcomeNames?: { challenger: string; declarer: string } | null;
  /**
   * Mirrors server `challengeTimer` during {@link GAME_PHASE.REVEAL} for the drama countdown bar.
   */
  challengeTimer?: number;
  /**
   * When set, REVEAL result chips show only **this** seat’s consequence (won pile vs penalty draw).
   * Omit on standalone {@link GameTable} for a neutral two-line fallback when truth resolves.
   */
  localPlayerId?: string;
  /** Optional: duel board — round pile rail center for flight FX (BoardView playmat anchors). */
  roundPileAnchorRef?: RefObject<HTMLDivElement | null> | null;
  drawStackAnchorRef?: RefObject<HTMLDivElement | null> | null;
}

/** Props for the inner playfield (metadata + claim / empty state). Used inside {@link GameTable} and embedded in {@link BoardView}. */
export type GameTablePlayfieldProps = GameTableProps & {
  /** When false, omits the “Player’s turn” line under the empty play slot (BoardView shows its own turn row). Default true. */
  showEmptyStateTurnLine?: boolean;
  /**
   * PENALTY / NEXT_TURN / TROPHY: panel rendered in the same center slot as the empty declare zone (BoardView).
   * Keeps one layout shell so phase transitions do not stack two siblings + strip exit.
   */
  roundResolutionPanel?: ReactNode | null;
};

/** Reduced-motion duration for play / empty cross-fade (seconds). */
const REDUCED_CARD_MOTION_DURATION_SECONDS = 0.16;

/**
 * When a claim is on the table (declare → challenge → reveal): one min-height so the card column
 * does not jump across phases. Caps in rem keep very large viewports from forcing excess scroll.
 */
const DECLARATION_PLAYFIELD_MIN_H_PLAYED_CLAIM =
  "sm:min-h-[min(56vh,38rem)] lg:min-h-[min(62vh,44rem)]";

/**
 * Shared shell: empty `PLAYER_TURN` drop zone and round-resolution panel (PENALTY / NEXT_TURN / TROPHY).
 * Vertical min matches {@link DECLARATION_PLAYFIELD_MIN_H_PLAYED_CLAIM} so the band does not jump when a claim
 * appears or clears while the side rails (contested pile) stay stable in the grid.
 */
const DECLARATION_PLAYFIELD_SHELL_EMPTY_LAYOUT =
  "relative z-10 mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-center gap-3 [perspective:1200px] py-2 sm:min-h-[min(56vh,38rem)] sm:py-4 lg:max-w-4xl lg:min-h-[min(62vh,44rem)]";

/**
 * Same vertical shell as {@link DECLARATION_PLAYFIELD_SHELL_EMPTY_LAYOUT} but wider max-width for
 * merged round-resolution UI (PENALTY two-column panel, NEXT_TURN, TROPHY) so the center track can
 * use horizontal space left by side rails.
 */
const DECLARATION_PLAYFIELD_SHELL_ROUND_RESOLUTION_LAYOUT =
  "relative z-10 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col justify-center gap-3 [perspective:1200px] py-2 sm:min-h-[min(56vh,38rem)] sm:py-4 lg:max-w-6xl lg:min-h-[min(62vh,44rem)] xl:max-w-7xl";

/**
 * Side rails (contested pile) stay **top-aligned** in the row so `items-center` does not vertically
 * recenter them when declaration `min-h` changes (declare vs REVEAL vs challenge).
 */
/**
 * Round pile stays column 1; **side tracks use fixed rem widths** (not `1fr`) so the center column cannot
 * grow with long wrapped copy and steal width — that was shifting the pile horizontally. Center is always
 * `minmax(0,1fr)` so text wraps inside a stable flex-minimum column.
 */
const PLAYFIELD_SIDE_RAIL_GRID_CLASS =
  "grid w-full min-w-0 flex-1 grid-cols-[9.5rem_minmax(0,1fr)] items-start gap-x-2 gap-y-2 sm:grid-cols-[10.5rem_minmax(0,1fr)_10.5rem] sm:gap-x-2 sm:gap-y-0 lg:gap-x-4";

/**
 * Shared wrapper: `roundPileAnchorRef` target for FX; always visible (not `hidden sm:flex`).
 * Height reserved for stack + chip; width comes from the fixed grid track ({@link PLAYFIELD_SIDE_RAIL_GRID_CLASS}).
 */
const PLAYFIELD_ROUND_PILE_ANCHOR_CELL_CLASS = cn(
  "col-start-1 row-start-1 flex w-full min-w-0 shrink-0 items-start justify-end self-start pr-0.5 sm:pr-2",
  "min-h-[12.5rem] sm:min-h-[14rem]",
);

const PILE_STACK_VISIBLE_MAX = 6;
const TABLEAU_STACK_DEPTH = 4;

/** Played claim on table and PLAYER_TURN drop slot: one width all phases (declare / challenge / reveal). */
const PLAYFIELD_CLAIM_CARD_WIDTH_PLAYED =
  "w-[12rem] sm:w-[13rem] lg:w-[15.5rem]";
/** PLAYER_TURN drag target: same footprint as played claim card. */
const PLAYFIELD_DROP_SLOT_CARD_BOX = PLAYFIELD_CLAIM_CARD_WIDTH_PLAYED;

/** Empty play slot (`PLAYER_TURN`): locked suit + chain rank on one line, rule text below. */
function PlayerTurnDeclareContextPanel({
  lockedSuit,
  lastResolvedDeclaration,
}: {
  lockedSuit: SpiceType | null;
  lastResolvedDeclaration: Declaration | null;
}) {
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  const lastNumRaw = lastResolvedDeclaration != null ? Number(lastResolvedDeclaration.number) : NaN;
  const lastNum = Number.isFinite(lastNumRaw) ? Math.floor(lastNumRaw) : null;

  if (lockedSuit == null) {
    return (
      <div
        className="w-full min-w-0 max-w-full rounded-md border border-dashed border-border/45 bg-muted/20 px-3 py-3 sm:px-4"
        role="region"
        aria-label={t("table.a11y.firstRoundDeclareContext")}
      >
        <p className="break-words text-center text-xs leading-relaxed text-muted-foreground">
          {t("table.firstRoundHint")}
        </p>
      </div>
    );
  }

  const ruleLine =
    lastNum != null
      ? lastNum >= MAX_DECLARATION_RANK
        ? t("table.rankCycleReset")
        : t("table.mustDeclareHigherThan", { number: lastNum })
      : t("table.followLockedSuit");

  const suitLabel = `${SPICE_LABEL[lockedSuit]}`;
  const chainAria =
    lastNum != null
      ? t("table.a11y.roundDeclareContextCompact", { suit: suitLabel, rank: lastNum })
      : t("table.a11y.roundDeclareContextSuitOnly", { suit: suitLabel });

  const trackClass = SPICE_DECLARE_CONTEXT_TRACK_CLASS[lockedSuit];
  const suitTextClass = SPICE_DECLARE_CONTEXT_SUIT_TEXT_CLASS[lockedSuit];
  const rankChipClass = SPICE_DECLARE_CONTEXT_RANK_CHIP_CLASS[lockedSuit];

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SNAPPY_SPRING}
      className={cn(
        "flex min-w-0 max-w-full flex-col items-center gap-2.5 px-3 py-3 sm:gap-3 sm:px-4 sm:py-3.5",
        trackClass,
      )}
      role="region"
      aria-label={chainAria}
    >
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        <motion.div
          key={lockedSuit}
          className="flex items-center gap-2 sm:gap-2.5"
          initial={reducedMotion ? false : { scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SNAPPY_SPRING, delay: reducedMotion ? 0 : 0.04 }}
        >
          <motion.span
            className="select-none text-3xl sm:text-4xl"
            aria-hidden
            animate={
              reducedMotion
                ? undefined
                : {
                    scale: [1, 1.06, 1],
                  }
            }
            transition={
              reducedMotion
                ? undefined
                : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
            }
          >
            {SPICE_EMOJI[lockedSuit]}
          </motion.span>
          <span
            className={cn(
              "font-headline text-lg font-semibold tracking-tight sm:text-xl",
              suitTextClass,
            )}
          >
            {SPICE_LABEL[lockedSuit]}
          </span>
        </motion.div>

        {lastNum != null ? (
          <>
            <span
              className="hidden h-9 w-px shrink-0 bg-border/55 sm:block"
              aria-hidden
            />
            <motion.div
              key={lastNum}
              className={cn(
                "flex items-center justify-center text-2xl sm:text-3xl",
                rankChipClass,
              )}
              initial={reducedMotion ? false : { scale: 0.72, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 440, damping: 24 }}
            >
              {lastNum}
            </motion.div>
          </>
        ) : null}
      </div>

      <p className="max-w-full break-words text-center text-[11px] leading-snug text-muted-foreground sm:text-xs">
        {ruleLine} {t("table.drawPassOptionSuffix")}
      </p>
    </motion.div>
  );
}

/** Face-down stack footprint — larger for tabletop legibility. */
const TABLEAU_CARD_W = "w-[7.25rem] sm:w-[8rem]";
const TABLEAU_CARD_H = "h-[10.875rem] sm:h-[12rem]";

const TABLEAU_LAYER_W_REM = "7rem";
const TABLEAU_LAYER_H_REM = "9rem";
const TABLEAU_LAYER_OFFSET_PX = 3.5;

/** Duel-board supply columns — larger trophy / draw stacks (see `SpiceCard` size `duel`). */
const DUEL_TABLEAU_CARD_W = "w-[8.875rem] sm:w-[10rem]";
const DUEL_TABLEAU_CARD_H = "h-[13.3125rem] sm:h-[15rem]";
const DUEL_TABLEAU_LAYER_W_REM = "8.5rem";
const DUEL_TABLEAU_LAYER_H_REM = "10.75rem";
const DUEL_TABLEAU_LAYER_OFFSET_PX = 4;

function stackLayerStyle(layer: number, total: number, offsetPx: number) {
  const offset = (total - 1 - layer) * offsetPx;
  return { left: offset, top: -offset, zIndex: layer };
}

type TableauPileKind = "trophy" | "draw" | "round" | "tw";

/** Flat zones on the felt — no nested “card behind card” panels. */
const TABLEAU_PILE_FRAME: Record<TableauPileKind, string> = {
  trophy: "ring-1 ring-[hsl(var(--trophy-gold)/0.35)]",
  draw: "ring-1 ring-foreground/[0.08]",
  round: "ring-1 ring-dashed ring-foreground/[0.12]",
  tw: "ring-1 ring-foreground/[0.08]",
};

function TableauPileMount({
  kind,
  label,
  countChild,
  stackChild,
}: {
  kind: TableauPileKind;
  label: ReactNode;
  countChild: ReactNode;
  stackChild: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg bg-transparent p-2 text-center sm:gap-2.5 sm:p-2.5",
        TABLEAU_PILE_FRAME[kind],
      )}
    >
      <p className="max-w-[6.5rem] text-[10px] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:max-w-none sm:text-[11px]">
        {label}
      </p>
      <div className="flex min-h-[10.5rem] flex-col items-center justify-end sm:min-h-[11.5rem]">
        {stackChild}
      </div>
      {countChild}
    </div>
  );
}

function TableauFaceDownStack({
  layers,
  className,
  preset = "tableau",
}: {
  layers: number;
  className?: string;
  preset?: "tableau" | "duel";
}) {
  const n = Math.max(0, Math.min(TABLEAU_STACK_DEPTH, layers));
  const cardW = preset === "duel" ? DUEL_TABLEAU_CARD_W : TABLEAU_CARD_W;
  const cardH = preset === "duel" ? DUEL_TABLEAU_CARD_H : TABLEAU_CARD_H;
  const layerW = preset === "duel" ? DUEL_TABLEAU_LAYER_W_REM : TABLEAU_LAYER_W_REM;
  const layerH = preset === "duel" ? DUEL_TABLEAU_LAYER_H_REM : TABLEAU_LAYER_H_REM;
  const offsetPx = preset === "duel" ? DUEL_TABLEAU_LAYER_OFFSET_PX : TABLEAU_LAYER_OFFSET_PX;
  return (
    <div className={cn("relative mx-auto", cardW, cardH, className)} aria-hidden>
      {n > 0 &&
        Array.from({ length: n }).map((_, layer) => (
          <div
            key={layer}
            className="absolute rounded-lg border-2 border-card-back/90 bg-card-back/90 shadow-card"
            style={{
              ...stackLayerStyle(layer, n, offsetPx),
              width: layerW,
              height: layerH,
            }}
          />
        ))}
      <CardBackSurface corner="lg" className={cn("absolute left-0 top-0 z-[10]", cardW, cardH)} />
    </div>
  );
}

/**
 * Single face-down duel card for draw-pass {@link DragOverlay} — one card is drawn, not the whole stack visual.
 */
export function DuelDrawPassDragGhost({ className }: { className?: string }) {
  return <TableauFaceDownStack layers={1} preset="duel" className={className} />;
}

/** Max face-down layers drawn in playfield side rails (decorative, not pile logic). */
const PLAYFIELD_RAIL_STACK_CAP = 2;

/**
 * Face-down cards in contested-pile rail — real back art via {@link CardBackSurface}, larger than the old CSS tiles.
 * Box height follows 2:3 from width ({@link GAME_CARD_ART_ASPECT_CLASS}).
 */
const PLAYFIELD_ROUND_CARD_BOX_CLASS = cn(
  GAME_CARD_ART_ASPECT_CLASS,
  "w-[5.75rem] sm:w-[6.5rem]",
);

/**
 * Fixed stack viewport: fits {@link PLAYFIELD_RAIL_STACK_CAP} layers + offsets + count chip overlap.
 * Explicit w/h prevents layout jump between empty (dashed) and stacked states.
 */
const PLAYFIELD_ROUND_STACK_VIEWPORT_CLASS =
  "relative h-[9.375rem] w-[6.75rem] shrink-0 overflow-visible rounded-lg bg-transparent sm:h-[10.5rem] sm:w-[7.5rem]";

/** Stacked inset — match physical card step (px keeps alignment at sub-rem offsets). */
const PLAYFIELD_ROUND_LAYER_OFFSET_X_PX = 6;
const PLAYFIELD_ROUND_LAYER_OFFSET_Y_PX = -5;

function PlayfieldRoundPileRail({ tablePileCount, className }: { tablePileCount: number; className?: string }) {
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  const visualLayers =
    tablePileCount <= 0 ? 0 : Math.min(tablePileCount, PLAYFIELD_RAIL_STACK_CAP);
  const pileAriaLabel = t("result.pileCardCount", { count: tablePileCount });

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full flex-col items-center justify-start pb-4 motion-reduce:transition-none",
        className,
      )}
      role="img"
      aria-label={pileAriaLabel}
    >
      {/**
       * Flat on the playmat — same intent as `.playmat-supply-*`: no panel wash, no pulsing outer glow.
       * Fixed viewport + {@link PLAYFIELD_ROUND_PILE_ANCHOR_CELL_CLASS} min size avoid jump empty↔stacked.
       * Face-down layers use {@link CardBackSurface} (real `/game/.../card_back.png` art).
       */}
      <div className={PLAYFIELD_ROUND_STACK_VIEWPORT_CLASS}>
        <motion.div
          className="relative h-full w-full"
          aria-hidden
          variants={{
            idle: {},
            float: {
              y: [0, -2, 0],
              transition: { duration: 5.2, repeat: Infinity, ease: "easeInOut" },
            },
          }}
          initial="idle"
          animate={reducedMotion || visualLayers === 0 ? "idle" : "float"}
        >
          {visualLayers === 0 ? (
            <motion.div
              className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-foreground/20 bg-transparent"
              initial={reducedMotion ? false : { opacity: 0.75, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SNAPPY_SPRING}
            />
          ) : (
            <motion.div
              key={tablePileCount}
              className="relative h-full w-full"
              variants={{
                hidden: {},
                show: {
                  transition: {
                    staggerChildren: reducedMotion ? 0 : 0.07,
                    delayChildren: 0.03,
                  },
                },
              }}
              initial="hidden"
              animate="show"
            >
              {Array.from({ length: visualLayers }).map((_, i) => (
                <motion.div
                  key={`${tablePileCount}-${i}`}
                  className={cn("absolute", PLAYFIELD_ROUND_CARD_BOX_CLASS)}
                  style={{
                    left: i * PLAYFIELD_ROUND_LAYER_OFFSET_X_PX,
                    top: i * PLAYFIELD_ROUND_LAYER_OFFSET_Y_PX,
                    zIndex: i,
                  }}
                  variants={{
                    hidden: reducedMotion
                      ? { opacity: 1, scale: 1 }
                      : { opacity: 0, scale: 0.88 },
                    show: {
                      opacity: 1,
                      scale: 1,
                      transition: SNAPPY_SPRING,
                    },
                  }}
                >
                  <CardBackSurface corner="lg" className="h-full w-full" />
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>

        <div
          className="pointer-events-none absolute bottom-0 left-1/2 z-20 flex min-w-[2rem] -translate-x-1/2 translate-y-[38%] justify-center px-0.5 sm:translate-y-[40%]"
          aria-hidden
        >
          <motion.span
            key={tablePileCount}
            className={cn(
              "inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-border/60",
              "bg-background/90 px-2 py-0.5 text-center font-headline text-xs font-black tabular-nums text-foreground",
              "shadow-sm backdrop-blur-sm sm:text-sm",
            )}
            initial={reducedMotion ? false : { scale: 0.82, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SNAPPY_SPRING}
          >
            {tablePileCount}
          </motion.span>
        </div>
      </div>
    </div>
  );
}

export type GameTableTableauSectionProps = Pick<
  GameTableProps,
  "drawPileCount" | "tablePileCount" | "supremeReserve" | "trophiesRemaining" | "lockedSuit"
> & {
  /** `full` = four supply zones (standalone table). `duel` = single column when `duelSlot` is set. */
  variant?: "full" | "duel";
  /** Which duel playmat column to render; required for `variant="duel"` in BoardView grid. */
  duelSlot?: "trophy" | "draw";
  drawStackAnchorRef?: RefObject<HTMLDivElement | null> | null;
  /** When set on the draw column, the face-down stack is draggable to the local hand (draw-and-pass). */
  drawPassPileDraggable?: DrawPassPileDraggableConfig | null;
};

/** Vertical trophy rail: three fixed `duel`-footprint slots (same width/height as a single duel {@link SpiceCard}). */
const TROPHY_DUEL_STACK_GAP = "gap-2 sm:gap-2.5" as const;

function GameTableDuelTrophyColumn({ trophiesRemaining }: { trophiesRemaining: number }) {
  const { t } = useTranslation("game");
  const awardedTrophyCount = Math.max(0, TOTAL_TROPHIES - trophiesRemaining);

  return (
    <div className="relative w-full max-w-[10.5rem] shrink-0 overflow-visible">
      {/** Zero in-flow height; panel is `absolute top-0` — BoardView anchors rails from the band top. */}
      <div className="h-0 w-full shrink-0 overflow-visible" aria-hidden />
      <div
        className={cn(
          "playmat-supply-trophy pointer-events-auto absolute left-0 top-0 z-20 flex w-[min(100%,10rem)] flex-col items-center gap-2 rounded-lg bg-transparent p-2 text-center sm:w-[10.5rem] sm:gap-2.5 sm:p-2.5",
          TABLEAU_PILE_FRAME.trophy,
        )}
      >
        <p className="max-w-[6.5rem] text-[10px] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:max-w-none sm:text-[11px]">
          {t("table.trophiesLeft")}
        </p>
        <div
          role="list"
          className={cn("flex w-full flex-col items-center", TROPHY_DUEL_STACK_GAP)}
          aria-label={t("table.trophyDuelRailAria", {
            remaining: trophiesRemaining,
            total: TOTAL_TROPHIES,
          })}
        >
          {Array.from({ length: TOTAL_TROPHIES }, (_, slot) => {
            const claimed = slot < awardedTrophyCount;
            return (
              <div key={slot} role="listitem" className={cn("shrink-0", DUEL_TABLEAU_CARD_W)}>
                {claimed ? (
                  <div
                    className={cn(
                      "flex aspect-[2/3] w-full flex-col items-center justify-center rounded-md border-2 border-dashed border-[hsl(var(--trophy-gold)/0.35)] bg-muted/20 text-xs font-semibold text-muted-foreground",
                    )}
                    aria-label={t("table.trophySlotClaimed")}
                  >
                    —
                  </div>
                ) : (
                  <SpiceCard card={TABLEAU_TROPHY_DISPLAY_CARD} size="duel" />
                )}
              </div>
            );
          })}
        </div>
        <span className="sr-only">
          {t("table.trophyDuelRailSr", {
            remaining: trophiesRemaining,
            total: TOTAL_TROPHIES,
          })}
        </span>
      </div>
    </div>
  );
}

function GameTableDuelDrawColumn({
  drawPileCount,
  drawStackAnchorRef = null,
  drawPassPileDraggable = null,
}: {
  drawPileCount: number;
  drawStackAnchorRef?: RefObject<HTMLDivElement | null> | null;
  drawPassPileDraggable?: DrawPassPileDraggableConfig | null;
}) {
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  const { active } = useDndContext();
  const drawStackVisualLayers =
    drawPileCount <= 0 ? 0 : Math.min(TABLEAU_STACK_DEPTH, 1 + Math.floor(drawPileCount / 9));

  const pileDraggable =
    drawPassPileDraggable?.active === true && drawPileCount > 0 && drawPassPileDraggable != null;

  const drawPassDragData = useMemo<GameDndDrawPassDragData>(
    () => ({ kind: GAME_DND_KIND.DRAW_PASS }),
    [],
  );

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: GAME_DND_DRAG_DRAW_PASS_ID,
    disabled: !pileDraggable,
    data: drawPassDragData,
  });

  const pileDragActive = active?.id === GAME_DND_DRAG_DRAW_PASS_ID;

  const mergedStackRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    if (drawStackAnchorRef) {
      drawStackAnchorRef.current = el;
    }
  };

  const [coachVisible, setCoachVisible] = useState(false);
  const prevPileDraggableRef = useRef(false);

  useEffect(() => {
    if (pileDraggable && !prevPileDraggableRef.current) {
      setCoachVisible(true);
      const id = window.setTimeout(() => setCoachVisible(false), DRAW_PASS_COACH_HINT_DISPLAY_MS);
      prevPileDraggableRef.current = true;
      return () => window.clearTimeout(id);
    }
    if (!pileDraggable) {
      prevPileDraggableRef.current = false;
      setCoachVisible(false);
    }
    return undefined;
  }, [pileDraggable]);

  const drawStackEl = (
    <div
      ref={mergedStackRef}
      className={cn(
        "inline-flex min-h-[3rem] min-w-[2.75rem] flex-col items-center justify-end touch-manipulation",
        pileDraggable && "cursor-grab select-none active:cursor-grabbing",
      )}
      style={
        pileDragActive ? { opacity: GAME_DND_DRAW_PASS_SOURCE_DIM_OPACITY } : undefined
      }
      {...listeners}
      {...attributes}
      aria-hidden={!pileDraggable}
      aria-label={pileDraggable ? t("table.drawPileDragAria") : undefined}
    >
      <motion.div
        key={drawPileCount}
        initial={{ scale: 0.96, opacity: 0.85 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SNAPPY_SPRING}
      >
        <div
          data-draw-stack-visual
          className={cn(
            "inline-flex flex-col items-center",
            pileDraggable &&
              !pileDragActive &&
              !reducedMotion &&
              "motion-safe:origin-bottom motion-safe:animate-draw-pile-stack-invite",
          )}
        >
          {drawStackVisualLayers > 0 ? (
            <TableauFaceDownStack layers={drawStackVisualLayers} preset="duel" />
          ) : (
            <div
              className={cn(
                "mx-auto flex items-center justify-center rounded-lg border-2 border-dashed border-foreground/20 bg-transparent",
                DUEL_TABLEAU_CARD_W,
                DUEL_TABLEAU_CARD_H,
              )}
            >
              <span className="text-xs font-semibold text-muted-foreground">—</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );

  /**
   * In-flow flex column (not `h-0` + all-`absolute` children): a zero-size shrink-wrap parent
   * breaks hit-testing / HTML5 drag hover even when paints correctly.
   */
  return (
    <div
      className={cn(
        "playmat-supply-draw relative z-20 flex w-[min(100%,10rem)] max-w-[10.5rem] shrink-0 flex-col items-center gap-2 overflow-visible rounded-xl border border-dashed border-border/35 bg-transparent p-2 text-center sm:w-[10.5rem] sm:gap-2.5 sm:p-2.5",
        TABLEAU_PILE_FRAME.draw,
        pileDraggable && "border-primary/30",
        pileDragActive && "z-30 ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
      )}
    >
      <AnimatePresence>
        {coachVisible && pileDraggable ? (
          <motion.div
            key="draw-pass-coach"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={SNAPPY_SPRING}
            className="pointer-events-none absolute -top-1 right-0 left-0 z-[35] mx-auto flex max-w-[11.5rem] -translate-y-full flex-col items-center gap-1 rounded-md border border-primary/35 bg-popover/95 px-2 py-1.5 shadow-md ring-1 ring-primary/15 backdrop-blur-sm sm:max-w-[13rem]"
            role="status"
            aria-live="polite"
          >
            <Icon name="swipe_down" size={18} className="text-primary" />
            <p className="text-[9px] font-medium leading-snug text-popover-foreground sm:text-[10px]">
              {t("table.drawPileDropHint")}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <p className="pointer-events-none max-w-[7.5rem] text-[10px] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:max-w-none sm:text-[11px]">
        {t("table.drawPile")}
      </p>
      <div className="flex w-full flex-col items-center justify-end">
        {pileDraggable ? (
          <Tooltip>
            <TooltipTrigger asChild>{drawStackEl}</TooltipTrigger>
            <TooltipContent
              side="left"
              align="center"
              sideOffset={10}
              className="max-w-[15rem] border-primary/30 bg-popover px-3 py-2 text-left text-xs shadow-lg"
            >
              <p className="font-headline font-bold text-foreground">{t("table.drawPileHintTitle")}</p>
              <p className="mt-1 leading-snug text-muted-foreground">{t("table.drawPileDropHint")}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          drawStackEl
        )}
      </div>
      {pileDraggable && drawPassPileDraggable?.onDrawPass != null ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 w-full max-w-full touch-manipulation text-[10px] font-bold sm:h-9 sm:text-xs"
          onClick={() => drawPassPileDraggable.onDrawPass?.()}
        >
          {t("table.drawPassTapButton")}
        </Button>
      ) : null}
      <strong className="pointer-events-none tabular-nums text-sm font-bold text-foreground">
        {drawPileCount}
      </strong>
    </div>
  );
}

/** Supply piles (trophy / draw / round / TW in full layout; duel columns in BoardView). */
export function GameTableTableauSection({
  drawPileCount,
  tablePileCount,
  supremeReserve,
  trophiesRemaining,
  lockedSuit,
  variant = "full",
  duelSlot,
  drawStackAnchorRef = null,
  drawPassPileDraggable = null,
}: GameTableTableauSectionProps) {
  const { t } = useTranslation("game");

  if (variant === "duel") {
    if (duelSlot === "trophy") {
      return <GameTableDuelTrophyColumn trophiesRemaining={trophiesRemaining} />;
    }
    if (duelSlot === "draw") {
      return (
        <GameTableDuelDrawColumn
          drawPileCount={drawPileCount}
          drawStackAnchorRef={drawStackAnchorRef}
          drawPassPileDraggable={drawPassPileDraggable}
        />
      );
    }
    return (
      <div className="flex w-full items-end justify-between gap-4 px-1">
        <GameTableDuelTrophyColumn trophiesRemaining={trophiesRemaining} />
        <GameTableDuelDrawColumn drawPileCount={drawPileCount} drawStackAnchorRef={drawStackAnchorRef} />
      </div>
    );
  }

  const awardedTrophies = Math.max(0, TOTAL_TROPHIES - trophiesRemaining);
  const drawStackVisualLayers =
    drawPileCount <= 0 ? 0 : Math.min(TABLEAU_STACK_DEPTH, 1 + Math.floor(drawPileCount / 9));
  const roundStackVisualLayers =
    tablePileCount <= 0 ? 0 : Math.min(TABLEAU_STACK_DEPTH, Math.max(1, Math.ceil(tablePileCount / 4)));
  const twStackVisualLayers =
    supremeReserve <= 0 ? 0 : Math.min(TABLEAU_STACK_DEPTH, 1 + Math.floor(supremeReserve / 3));

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <TableauPileMount
          kind="trophy"
          label={t("table.trophiesLeft")}
          stackChild={
            <div className="flex flex-wrap justify-center gap-1" aria-label={t("table.trophiesLeft")}>
              {Array.from({ length: TOTAL_TROPHIES }).map((_, i) => {
                const filled = i < awardedTrophies;
                return (
                  <span
                    key={i}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm transition-transform duration-300 sm:h-10 sm:w-10",
                      filled
                        ? "border-[hsl(var(--trophy-gold)/0.85)] bg-[hsl(var(--trophy-gold)/0.18)] text-[hsl(var(--trophy-gold))] shadow-[0_0_14px_hsl(var(--trophy-glow)/0.45)]"
                        : "border-border/55 bg-muted/25 text-muted-foreground opacity-50",
                    )}
                    aria-hidden
                  >
                    🏆
                  </span>
                );
              })}
            </div>
          }
          countChild={<strong className="tabular-nums text-sm font-bold text-foreground">{trophiesRemaining}</strong>}
        />

        <TableauPileMount
          kind="draw"
          label={t("table.drawPile")}
          stackChild={
            <motion.div
              key={drawPileCount}
              initial={{ scale: 0.96, opacity: 0.85 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SNAPPY_SPRING}
            >
              {drawStackVisualLayers > 0 ? (
                <TableauFaceDownStack layers={drawStackVisualLayers} />
              ) : (
                <div
                  className={cn(
                    "mx-auto flex items-center justify-center rounded-lg border-2 border-dashed border-foreground/20 bg-transparent",
                    TABLEAU_CARD_W,
                    TABLEAU_CARD_H,
                  )}
                >
                  <span className="text-xs font-semibold text-muted-foreground">—</span>
                </div>
              )}
            </motion.div>
          }
          countChild={<strong className="tabular-nums text-sm font-bold text-foreground">{drawPileCount}</strong>}
        />

        <TableauPileMount
          kind="round"
          label={t("table.roundPile")}
          stackChild={
            <motion.div
              key={tablePileCount}
              initial={{ scale: 0.97 }}
              animate={{ scale: 1 }}
              transition={SNAPPY_SPRING}
            >
              {roundStackVisualLayers > 0 ? (
                <TableauFaceDownStack layers={roundStackVisualLayers} />
              ) : (
                <div
                  className={cn(
                    "mx-auto flex items-center justify-center rounded-lg border-2 border-dashed border-foreground/20 bg-transparent",
                    TABLEAU_CARD_W,
                    TABLEAU_CARD_H,
                  )}
                >
                  <span className="text-xs font-semibold text-muted-foreground">0</span>
                </div>
              )}
            </motion.div>
          }
          countChild={<strong className="tabular-nums text-sm font-bold text-foreground">{tablePileCount}</strong>}
        />

        <TableauPileMount
          kind="tw"
          label={t("table.supremeReserve")}
          stackChild={
            <motion.div
              key={supremeReserve}
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              transition={SNAPPY_SPRING}
            >
              {twStackVisualLayers > 0 ? (
                <TableauFaceDownStack layers={twStackVisualLayers} className="opacity-95" />
              ) : (
                <div
                  className={cn(
                    "mx-auto flex items-center justify-center rounded-lg border-2 border-dashed border-foreground/20 bg-transparent",
                    TABLEAU_CARD_W,
                    TABLEAU_CARD_H,
                  )}
                >
                  <span className="text-xs font-bold text-secondary">TW</span>
                </div>
              )}
            </motion.div>
          }
          countChild={<strong className="tabular-nums text-sm font-bold text-foreground">{supremeReserve}</strong>}
        />
      </div>
    </div>
  );
}

export type GameTableDeclarationSectionProps = Pick<
  GameTablePlayfieldProps,
  | "playedCard"
  | "currentPlayerName"
  | "phase"
  | "lastResolvedDeclaration"
  | "lockedSuit"
  | "tablePileCount"
  | "showEmptyStateTurnLine"
  | "playDropZone"
  | "challengeResult"
  | "challengeOutcomeNames"
  | "challengeTimer"
  | "localPlayerId"
  | "roundPileAnchorRef"
  | "roundResolutionPanel"
>;

/** Center play area: current claim or empty “play here” — mounts below {@link GameTableTableauSection}. */
export function GameTableDeclarationSection({
  playedCard,
  currentPlayerName,
  phase,
  lastResolvedDeclaration,
  lockedSuit,
  tablePileCount,
  showEmptyStateTurnLine = true,
  playDropZone = null,
  challengeResult = null,
  challengeOutcomeNames = null,
  challengeTimer = 0,
  localPlayerId = "",
  roundPileAnchorRef = null,
  roundResolutionPanel = null,
}: GameTableDeclarationSectionProps) {
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  const { active } = useDndContext();

  const inRevealLock =
    phase === GAME_PHASE.REVEAL &&
    challengeResult != null &&
    challengeTimer > REVEAL_REMAIN_AFTER_LOCK_THRESHOLD;

  const isPlayDropTarget =
    playDropZone != null && phase === GAME_PHASE.PLAYER_TURN && playedCard == null;

  const { setNodeRef: setPlayDropSlotRef, isOver: isPlayDropPointerOver } = useDroppable({
    id: GAME_DND_DROP_PLAY_ZONE,
    disabled: !isPlayDropTarget,
  });

  const drawPassDragActive = active != null && isGameDndDrawPassData(active.data.current);
  const playDropPointerOverForDeclare =
    isPlayDropPointerOver && active != null && isGameDndDeclareCardData(active.data.current);
  const playDropStrongHighlight =
    isPlayDropTarget &&
    !drawPassDragActive &&
    (playDropZone?.highlighted === true || playDropPointerOverForDeclare);

  /**
   * Stable for the **current claim** only — must not include {@link tablePileCount}. The round pile rail
   * grows as contested cards accumulate; that stack is visually continuous with this center card. Bumping
   * the key on pile depth forced a remount and replayed the “deal to table” entrance.
   */
  const playCardMotionKey = useMemo(() => {
    if (playedCard == null) return "empty";
    const cardId =
      playedCard.card != null ? playedCard.card.id : `pending-${playedCard.declaration.type}-${playedCard.declaration.number}`;
    return `play-${playedCard.playerId}-${cardId}`;
  }, [playedCard]);

  const pileLayers = Math.min(tablePileCount, PILE_STACK_VISIBLE_MAX);

  const showDeclaredCardFace =
    phase === GAME_PHASE.REVEAL &&
    playedCard != null &&
    playedCard.card != null &&
    !inRevealLock;

  /** Plain-text outcome for assistive tech (visual outcome is portal FX + PENALTY strip). */
  const revealOutcomeSrText = useMemo(() => {
    if (phase !== GAME_PHASE.REVEAL || challengeResult == null || !showDeclaredCardFace) return null;
    const challenger = (challengeOutcomeNames?.challenger ?? "").trim() || DEFAULT_LOBBY_NICKNAME;
    const declarer = (challengeOutcomeNames?.declarer ?? "").trim() || DEFAULT_LOBBY_NICKNAME;
    const { challengeCorrect, timedOut, challengeType } = challengeResult;
    const axisWord =
      challengeType === "suit" ? t("result.suitAttr") : t("result.numberAttr");
    const axisLead = t("result.challenged", { type: axisWord });
    const timeoutBranch = timedOut === true && !challengeCorrect;
    if (timeoutBranch) {
      return [axisLead, t("result.challengeTimedOut"), t("result.declarerTakesPile"), t("result.challengerPenalty", { player: challenger })].join(" ");
    }
    if (challengeCorrect) {
      return [
        axisLead,
        t("challenge.bluffCaught"),
        `${challenger} ${t("result.challengeCorrect")}`,
        t("result.challengerTakesPile"),
        t("result.declarerPenaltyBluffCaught", { player: declarer }),
      ].join(" ");
    }
    return [
      axisLead,
      t("result.wasTruth"),
      `${declarer} ${t("result.wasTruthMessage")}`,
      t("result.challengerPenalty", { player: challenger }),
      t("result.declarerTakesPile"),
    ].join(" ");
  }, [phase, challengeResult, showDeclaredCardFace, challengeOutcomeNames, t]);

  const claimFlipAriaLabel = useMemo(() => {
    if (playedCard == null) return "";
    const claimLine = `${t("table.claimIs")}: ${SPICE_LABEL[playedCard.declaration.type]} ${playedCard.declaration.number}`;
    const lockedReveal =
      phase === GAME_PHASE.REVEAL &&
      challengeResult != null &&
      playedCard.card != null &&
      challengeTimer > REVEAL_REMAIN_AFTER_LOCK_THRESHOLD;
    if (lockedReveal) {
      return `${t("table.a11y.faceDownPlay")} — ${claimLine}. ${t("challenge.revealLockAria")}`;
    }
    const base =
      phase === GAME_PHASE.REVEAL && playedCard.card != null
        ? `${t("table.a11y.currentClaimDetails")} — ${claimLine}`
        : `${t("table.a11y.faceDownPlay")} — ${claimLine}`;
    if (phase === GAME_PHASE.REVEAL && challengeResult) {
      const { challengeCorrect, timedOut } = challengeResult;
      if (timedOut && !challengeCorrect) {
        return `${base}. ${t("result.challengeTimedOut")}`;
      }
      if (challengeCorrect) {
        return `${base}. ${t("challenge.bluffCaught")}`;
      }
      return `${base}. ${t("result.wasTruth")}`;
    }
    return base;
  }, [playedCard, phase, challengeResult, challengeTimer, t]);

  const roundInterstitialEmpty = playedCard == null && isRoundResolutionInterstitialPhase(phase);

  /** Challenge / REVEAL: action strip is in BoardView below this band — avoid tall `min-h` + vertical centering (false gap above BLUFF). */
  const compactPlayedClaimBand =
    phase === GAME_PHASE.CHALLENGE_PHASE || phase === GAME_PHASE.REVEAL;

  return (
    <div className="relative min-h-0 w-full">
      {playedCard != null ? (
        <div
          className={cn(
            "relative z-10 mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-3 [perspective:1200px] py-2 sm:py-4 lg:max-w-4xl",
            compactPlayedClaimBand ? "justify-start" : "justify-center",
            compactPlayedClaimBand ? "min-h-0" : DECLARATION_PLAYFIELD_MIN_H_PLAYED_CLAIM,
          )}
        >
            {/* `1fr auto 1fr` on sm+: round pile column 1 is stable vs mobile `auto | 1fr` (no separate top row). */}
            <div className={PLAYFIELD_SIDE_RAIL_GRID_CLASS}>
              <div
                ref={roundPileAnchorRef ?? undefined}
                className={PLAYFIELD_ROUND_PILE_ANCHOR_CELL_CLASS}
              >
                <motion.div
                  className="rounded-2xl"
                  animate={
                    phase === GAME_PHASE.REVEAL &&
                    challengeResult &&
                    showDeclaredCardFace &&
                    !reducedMotion
                      ? {
                          boxShadow: [
                            "0 0 0 0px hsl(var(--primary) / 0)",
                            "0 0 0 3px hsl(var(--primary) / 0.22)",
                            "0 0 0 0px hsl(var(--primary) / 0)",
                          ],
                        }
                      : { boxShadow: "0 0 0 0px transparent" }
                  }
                  transition={
                    phase === GAME_PHASE.REVEAL &&
                    challengeResult &&
                    showDeclaredCardFace &&
                    !reducedMotion
                      ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.15 }
                  }
                >
                  <PlayfieldRoundPileRail tablePileCount={tablePileCount} />
                </motion.div>
              </div>

              <div
                className={cn(
                  "col-start-2 flex w-full min-w-0 flex-col items-center justify-self-stretch sm:col-start-2",
                  compactPlayedClaimBand ? "justify-start" : "justify-center",
                )}
              >
                <motion.div
                  key={playCardMotionKey}
                  className="flex w-full min-w-0 max-w-[min(100%,26rem)] flex-col items-center gap-2 px-1 text-center sm:max-w-[min(100%,28rem)] sm:gap-2.5"
                  initial={
                    reducedMotion
                      ? { opacity: 0 }
                      : {
                          y: PLAYFIELD_CLAIM_ENTRANCE_OFFSET_Y_PX,
                          opacity: 0,
                          rotateZ: -PLAYFIELD_CLAIM_ENTRANCE_ROTATE_Z_DEG,
                          scale: PLAYFIELD_CLAIM_ENTRANCE_INITIAL_SCALE,
                        }
                  }
                  animate={{ y: 0, opacity: 1, rotateZ: 0, scale: 1 }}
                  transition={
                    reducedMotion
                      ? { duration: REDUCED_CARD_MOTION_DURATION_SECONDS, ease: PHASE_EASE_OUT }
                      : PLAY_CARD_TO_TABLE_SPRING
                  }
                >
                  <div className="w-full">
                    <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">
                      {t("table.currentClaim")}
                    </p>
                    <p className="mt-1 font-headline text-lg font-semibold tabular-nums leading-snug text-foreground sm:text-xl">
                      {SPICE_EMOJI[playedCard.declaration.type]} {SPICE_LABEL[playedCard.declaration.type]}{" "}
                      <span className="text-primary">{playedCard.declaration.number}</span>
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="relative z-10 cursor-default rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        tabIndex={0}
                        aria-label={claimFlipAriaLabel}
                      >
                        <div
                          className={cn(
                            "relative z-[1] aspect-[2/3] shrink-0 overflow-hidden rounded-md",
                            PLAYFIELD_CLAIM_CARD_WIDTH_PLAYED,
                          )}
                        >
                          {pileLayers > 0 &&
                            Array.from({ length: Math.min(pileLayers, 4) }).map((_, layer) => (
                              <div
                                key={layer}
                                className="absolute rounded-md bg-card-back/80 shadow-sm"
                                style={{
                                  width: "calc(100% - 4px)",
                                  height: "calc(100% - 6px)",
                                  left: layer * 5,
                                  top: layer * -4,
                                  zIndex: layer,
                                }}
                                aria-hidden
                              />
                            ))}
                          <div className="absolute left-0 top-0 z-[20] h-full w-full will-change-transform">
                            <PlayfieldDeclaredCardFlip
                              faceCard={playedCard.card}
                              showFaceUp={showDeclaredCardFace}
                              ariaLabel={claimFlipAriaLabel}
                              className="h-full w-full"
                            />
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-left text-xs">
                      <p className="font-medium text-foreground">{t("table.claimIs")}</p>
                      <p className="mt-1 tabular-nums text-muted-foreground">
                        {SPICE_EMOJI[playedCard.declaration.type]} {SPICE_LABEL[playedCard.declaration.type]}{" "}
                        <span className="text-foreground">{playedCard.declaration.number}</span>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  {revealOutcomeSrText ? (
                    <p className="sr-only" role="status">
                      {revealOutcomeSrText}
                    </p>
                  ) : null}
                </motion.div>
              </div>

              <div className="hidden min-w-0 sm:col-start-3 sm:block" aria-hidden />
            </div>
        </div>
      ) : roundInterstitialEmpty && roundResolutionPanel != null ? (
        <motion.div
          key="round-resolution-merged"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: REDUCED_CARD_MOTION_DURATION_SECONDS }}
          className={cn(DECLARATION_PLAYFIELD_SHELL_ROUND_RESOLUTION_LAYOUT, "w-full shrink-0")}
        >
          <div className={PLAYFIELD_SIDE_RAIL_GRID_CLASS}>
            <div ref={roundPileAnchorRef ?? undefined} className={PLAYFIELD_ROUND_PILE_ANCHOR_CELL_CLASS}>
              <PlayfieldRoundPileRail tablePileCount={tablePileCount} />
            </div>
            <div className="col-start-2 flex w-full min-w-0 flex-col items-stretch justify-center justify-self-stretch sm:col-start-2">
              <AnimatePresence mode="wait" initial={false}>
                {roundResolutionPanel != null ? (
                  <motion.div
                    key={phase}
                    initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={SNAPPY_SPRING}
                    className="flex w-full min-h-0 min-w-0 max-w-full flex-col items-stretch justify-center overflow-y-auto overflow-x-hidden overscroll-y-contain px-1 py-2 sm:px-2 sm:py-3"
                  >
                    {roundResolutionPanel}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
            <div className="hidden min-w-0 sm:col-start-3 sm:block" aria-hidden />
          </div>
        </motion.div>
      ) : roundInterstitialEmpty ? (
        <div
          className={cn("relative min-h-0 w-full shrink-0", DECLARATION_PLAYFIELD_SHELL_EMPTY_LAYOUT)}
          aria-hidden
        >
          {/**
           * Invisible proxy for round-pile FX origin during interstitials (rails unmounted with `playedCard`).
           */}
          <div
            ref={roundPileAnchorRef ?? undefined}
            className="invisible absolute left-[max(0.25rem,6vw)] top-[min(10vh,4.5rem)] z-0 sm:left-[8%] sm:top-[min(12vh,5.5rem)]"
          >
            <PlayfieldRoundPileRail tablePileCount={tablePileCount} />
          </div>
        </div>
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: REDUCED_CARD_MOTION_DURATION_SECONDS }}
          className={cn(
            phase === GAME_PHASE.PLAYER_TURN
              ? DECLARATION_PLAYFIELD_SHELL_EMPTY_LAYOUT
              : "mx-auto flex w-full max-w-md flex-col items-center gap-4 py-4 text-center",
          )}
        >
            {phase === GAME_PHASE.PLAYER_TURN ? (
              <>
                <div className={PLAYFIELD_SIDE_RAIL_GRID_CLASS}>
                  <div ref={roundPileAnchorRef ?? undefined} className={PLAYFIELD_ROUND_PILE_ANCHOR_CELL_CLASS}>
                    <PlayfieldRoundPileRail tablePileCount={tablePileCount} />
                  </div>

                  <div className="col-start-2 flex w-full min-w-0 flex-col items-center justify-center justify-self-stretch sm:col-start-2">
                    <div className="flex w-full min-w-0 max-w-[min(100%,32rem)] flex-col items-center gap-3 px-1 text-center sm:gap-4">
                      {showEmptyStateTurnLine ? (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{currentPlayerName}</span> {t("turn.isTurn")}
                        </p>
                      ) : null}

                      <PlayerTurnDeclareContextPanel
                        lockedSuit={lockedSuit}
                        lastResolvedDeclaration={lastResolvedDeclaration}
                      />

                      <div
                        ref={setPlayDropSlotRef}
                        role={isPlayDropTarget ? "region" : undefined}
                        aria-label={isPlayDropTarget ? t("hand.dropToPlayAria") : t("table.a11y.playSlot")}
                        className={cn(
                          "relative z-10 mt-1 aspect-[2/3] shrink-0 overflow-hidden rounded-md sm:mt-2",
                          PLAYFIELD_DROP_SLOT_CARD_BOX,
                        )}
                      >
                        {pileLayers > 0 &&
                          Array.from({ length: Math.min(pileLayers, 4) }).map((_, layer) => (
                            <div
                              key={layer}
                              className="absolute rounded-md bg-muted/50 shadow-sm ring-1 ring-border/40"
                              style={{
                                width: "calc(100% - 4px)",
                                height: "calc(100% - 6px)",
                                left: layer * 5,
                                top: layer * -4,
                                zIndex: layer,
                              }}
                              aria-hidden
                            />
                          ))}
                        <div
                          className={cn(
                            "absolute left-0 top-0 z-[20] flex h-full w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-md border-2 border-dashed px-2 transition-[transform,box-shadow,background-color,border-color] duration-200 motion-reduce:transition-none",
                            isPlayDropTarget
                              ? playDropStrongHighlight
                                ? "scale-[1.03] border-primary bg-primary/15 shadow-[var(--shadow-glow)] ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
                                : cn(
                                    "border-primary/40 bg-muted/15",
                                    !drawPassDragActive &&
                                      !reducedMotion &&
                                      "motion-safe:animate-play-drop-slot-invite",
                                  )
                              : "border-border/50 bg-muted/10",
                          )}
                        >
                          {isPlayDropTarget ? (
                            <>
                              <Icon
                                name="move_down"
                                size={44}
                                className={cn(
                                  "text-primary/60",
                                  !drawPassDragActive &&
                                    !reducedMotion &&
                                    "motion-safe:animate-bounce",
                                )}
                              />
                              <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {t("table.dropSlotHint")}
                              </p>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="hidden min-w-0 sm:col-start-3 sm:block" aria-hidden />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "relative aspect-[2/3]",
                      PLAYFIELD_CLAIM_CARD_WIDTH_PLAYED,
                    )}
                    aria-label={t("table.a11y.playSlot")}
                  >
                    {tablePileCount > 0 &&
                      Array.from({ length: Math.min(3, pileLayers) }).map((_, layer) => (
                        <div
                          key={layer}
                          className="absolute rounded-lg border-2 border-dashed border-foreground/15 bg-transparent"
                          style={{
                            width: "calc(100% - 6px)",
                            height: "calc(100% - 8px)",
                            left: layer * 5,
                            top: layer * -4,
                            zIndex: layer,
                          }}
                          aria-hidden
                        />
                      ))}
                    <div className="absolute left-0 top-0 z-[5] flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-foreground/20 bg-transparent" />
                  </div>
                </div>
                {showEmptyStateTurnLine ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{currentPlayerName}</span> {t("turn.isTurn")}
                  </p>
                ) : null}
              </>
            )}
        </motion.div>
      )}
    </div>
  );
}

/**
 * Full playfield: supply rail + declaration center (used by standalone {@link GameTable}).
 */
export function GameTablePlayfield(props: GameTablePlayfieldProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: GAME_DND_POINTER_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: GAME_DND_TOUCH_ACTIVATION_DELAY_MS,
        tolerance: GAME_DND_TOUCH_ACTIVATION_TOLERANCE_PX,
      },
    }),
  );

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={() => undefined}>
      <div className="flex w-full flex-col gap-3 sm:gap-4">
        <GameTableTableauSection
          drawPileCount={props.drawPileCount}
          tablePileCount={props.tablePileCount}
          supremeReserve={props.supremeReserve}
          trophiesRemaining={props.trophiesRemaining}
          lockedSuit={props.lockedSuit}
        />
        <GameTableDeclarationSection
          playedCard={props.playedCard}
          currentPlayerName={props.currentPlayerName}
          phase={props.phase}
          lastResolvedDeclaration={props.lastResolvedDeclaration}
          lockedSuit={props.lockedSuit}
          tablePileCount={props.tablePileCount}
          showEmptyStateTurnLine={props.showEmptyStateTurnLine}
          playDropZone={props.playDropZone}
          challengeResult={props.challengeResult}
          challengeOutcomeNames={props.challengeOutcomeNames}
          challengeTimer={props.challengeTimer}
          localPlayerId={props.localPlayerId}
          roundPileAnchorRef={props.roundPileAnchorRef}
          roundResolutionPanel={props.roundResolutionPanel ?? null}
        />
      </div>
    </DndContext>
  );
}

export function GameTable({
  playedCard,
  currentPlayerName,
  phase,
  lastResolvedDeclaration,
  lockedSuit,
  tablePileCount,
  drawPileCount,
  supremeReserve,
  trophiesRemaining,
}: GameTableProps) {
  const { t } = useTranslation("game");

  if (phase === "LOBBY") {
    return (
      <div
        className={cn(
          "flex min-h-[200px] flex-col items-center justify-center px-4 py-6 sm:min-h-[220px]",
          "game-table-surface rounded-3xl border border-border/25 shadow-kawaii",
        )}
      >
        <p className="max-w-md text-center text-sm leading-relaxed text-muted-foreground">
          {t("table.lobbyHint")}
        </p>
      </div>
    );
  }

  if (phase === "END_GAME") {
    return null;
  }

  return (
    <div className="w-full [perspective:1400px]">
      <div
        className={cn(
          "relative z-0 flex min-h-[200px] w-full flex-col items-center justify-center gap-4 px-2 py-4 sm:min-h-[240px] sm:px-3 sm:py-6",
        )}
      >
        <GameTablePlayfield
          playedCard={playedCard}
          currentPlayerName={currentPlayerName}
          phase={phase}
          lastResolvedDeclaration={lastResolvedDeclaration}
          lockedSuit={lockedSuit}
          tablePileCount={tablePileCount}
          drawPileCount={drawPileCount}
          supremeReserve={supremeReserve}
          trophiesRemaining={trophiesRemaining}
        />
      </div>
    </div>
  );
}
