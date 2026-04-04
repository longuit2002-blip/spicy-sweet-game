"use client";

/**
 * Full-screen VFX for round resolution. Optional raster decals: generate offline via
 * `.cursor/skills/openai-image-gen` into `apps/web/public/game/` if the stock card-back read feels thin.
 *
 * Semantics match `game-logic` / `applyPenalty` and `isChallengeCorrect`. Only **local** consequences
 * are animated: bluff caught and you are challenger -> rail to your won pile; truth and you are
 * challenger -> deck to hand (with flip when we have draw info); truth and you are declarer ->
 * rail to your won pile; if you are neither seat, no flight.
 */

import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { PENALTY_DRAW_COUNT } from "@sweet-spicy/game-logic";
import type { ChallengeResult, GameCard } from "@/shared/types/game";
import { GAME_PHASE, type GamePhase } from "@/shared/types/game";
import { SNAPPY_SPRING } from "@/features/game/animations";
import { CardBackSurface } from "@/features/game/components/CardBackSurface";
import { SpiceCard } from "@/features/game/components/SpiceCard";
import { usePlaymatAnchors } from "@/features/game/components/playmat-anchors";
import {
  GAME_PLAYER_HAND_ANCHOR_ID,
  GAME_PLAYER_WON_PILE_ANCHOR_ID,
  ROUND_RESOLUTION_DRAW_FLIP_AT,
  ROUND_RESOLUTION_FX_MAX_PILE_CARDS,
  ROUND_RESOLUTION_FX_Z,
} from "@/lib/game-room.constants";
import { cn } from "@/lib/utils";

const GHOST_CARD_W_PX = 44;
const GHOST_CARD_H_PX = 62;
/** Fits {@link SpiceCard} `small` footprint (~`w-14` Ã— 2:3) inside ghost bounds. */
const SPICE_CARD_SMALL_NOTIONAL_W_PX = 56;
const SPICE_CARD_SMALL_NOTIONAL_H_PX = 84;
const PENALTY_FLIP_FACE_SCALE = Math.min(
  GHOST_CARD_W_PX / SPICE_CARD_SMALL_NOTIONAL_W_PX,
  GHOST_CARD_H_PX / SPICE_CARD_SMALL_NOTIONAL_H_PX,
);
const FX_STAGGER_SECONDS = 0.055;
/** Extra dwell so draw + flip finishes before unmount. */
const ROUND_RESOLUTION_DRAW_CLEAR_MS = 1280;
const ROUND_RESOLUTION_PILE_CLEAR_MS = 920;

export type PenaltyFxSnapshot = {
  result: ChallengeResult;
  pileCardCount: number;
  /** Populated for local challenger only â€” cards drawn from the deck this penalty (for flip reveal). */
  penaltyDrawnCards?: readonly GameCard[] | null;
};

function rectCenter(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function fallbackRecipientPoint(): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.82 };
}

function fallbackWonPoolPoint(): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return { x: window.innerWidth * 0.18, y: window.innerHeight * 0.78 };
}

export type RoundResolutionFxOverlayProps = {
  phase: GamePhase;
  penaltyFxSnapshot: PenaltyFxSnapshot | null;
  localPlayerId: string;
};

type BacksFlightTrack = {
  trackKey: string;
  kind: "backs";
  from: { x: number; y: number };
  to: { x: number; y: number };
  count: number;
};

type DrawFlightTrack = {
  trackKey: string;
  kind: "draw";
  from: { x: number; y: number };
  to: { x: number; y: number };
  count: number;
  drawnCards: readonly GameCard[] | null;
};

type FlightTrack = BacksFlightTrack | DrawFlightTrack;

type FlightBundle = {
  bundleKey: string;
  tracks: FlightTrack[];
};

function pileGhostCount(pileCardCount: number): number {
  return Math.min(Math.max(pileCardCount, 1), ROUND_RESOLUTION_FX_MAX_PILE_CARDS);
}

function PenaltyDrawFlightCard({
  card,
  index,
  from,
  dx,
  dy,
  shouldFlipFace,
}: {
  card: GameCard | undefined;
  index: number;
  from: { x: number; y: number };
  dx: number;
  dy: number;
  shouldFlipFace: boolean;
}) {
  const delay = index * FX_STAGGER_SECONDS;
  const flipAt = ROUND_RESOLUTION_DRAW_FLIP_AT;

  if (shouldFlipFace && card) {
    return (
      <motion.div
        className={cn("absolute [transform-style:preserve-3d] rounded-md")}
        style={{
          left: from.x,
          top: from.y,
          width: GHOST_CARD_W_PX,
          height: GHOST_CARD_H_PX,
          marginLeft: -GHOST_CARD_W_PX / 2,
          marginTop: -GHOST_CARD_H_PX / 2,
        }}
        initial={{ x: 0, y: 0, opacity: 0, scale: 0.88, rotateY: 0 }}
        animate={{
          x: [0, dx, dx],
          y: [0, dy, dy],
          opacity: [0, 1, 1],
          scale: [0.88, 1, 1],
          rotateY: [0, 0, 180],
        }}
        transition={{
          duration: 0.82,
          delay,
          times: [0, flipAt, 1],
          ease: "easeInOut",
        }}
      >
        <div
          className={cn(
            "absolute inset-0 overflow-hidden rounded-md border border-border shadow-md [backface-visibility:hidden]",
          )}
          style={{ transform: "rotateY(180deg)" }}
        >
          <div className="flex h-full w-full items-center justify-center overflow-hidden">
            <div
              className="origin-center"
              style={{ transform: `scale(${PENALTY_FLIP_FACE_SCALE})` }}
            >
              <SpiceCard card={card} small artOnly />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <CardBackSurface corner="default" className="h-full w-full" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="absolute rounded-md [transform-style:preserve-3d]"
      style={{
        left: from.x,
        top: from.y,
        width: GHOST_CARD_W_PX,
        height: GHOST_CARD_H_PX,
        marginLeft: -GHOST_CARD_W_PX / 2,
        marginTop: -GHOST_CARD_H_PX / 2,
      }}
      initial={{ x: 0, y: 0, opacity: 0, scale: 0.88 }}
      animate={{ x: dx, y: dy, opacity: 1, scale: 1 }}
      transition={{ ...SNAPPY_SPRING, delay }}
    >
      <CardBackSurface corner="default" className="h-full w-full shadow-md" />
    </motion.div>
  );
}

function BacksFlightLayer({ track }: { track: BacksFlightTrack }) {
  const { from, to, count, trackKey } = track;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={`${trackKey}-pile-${i}`}
          className={cn(
            "absolute rounded-md border border-border shadow-md will-change-transform [transform-style:preserve-3d]",
          )}
          style={{
            left: from.x,
            top: from.y,
            width: GHOST_CARD_W_PX,
            height: GHOST_CARD_H_PX,
            marginLeft: -GHOST_CARD_W_PX / 2,
            marginTop: -GHOST_CARD_H_PX / 2,
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.88 }}
          animate={{ x: dx, y: dy, opacity: 1, scale: 1 }}
          transition={{ ...SNAPPY_SPRING, delay: i * FX_STAGGER_SECONDS }}
        >
          <CardBackSurface corner="default" className="h-full w-full" framed />
        </motion.div>
      ))}
    </>
  );
}

function clearMsForBundle(tracks: FlightTrack[]): number {
  let ms = ROUND_RESOLUTION_PILE_CLEAR_MS;
  for (const t of tracks) {
    if (t.kind === "draw") {
      const withFlip = t.drawnCards != null && t.drawnCards.length === t.count;
      ms = Math.max(ms, withFlip ? ROUND_RESOLUTION_DRAW_CLEAR_MS : 1100);
    }
  }
  return ms;
}

export function RoundResolutionFxOverlay({
  phase,
  penaltyFxSnapshot,
  localPlayerId,
}: RoundResolutionFxOverlayProps) {
  const reducedMotion = useReducedMotion() === true;
  const { drawStackRef, roundPileRailRef } = usePlaymatAnchors();
  const lastRunKeyRef = useRef<string>("");
  const [bundle, setBundle] = useState<FlightBundle | null>(null);

  useLayoutEffect(() => {
    if (phase !== GAME_PHASE.PENALTY) {
      lastRunKeyRef.current = "";
      setBundle(null);
      return;
    }
    if (!penaltyFxSnapshot) {
      setBundle(null);
      return;
    }

    const { result, pileCardCount, penaltyDrawnCards: snapshotDrawn } = penaltyFxSnapshot;
    const runKey = `${result.challengerId}-${result.playerId}-${String(result.challengeCorrect)}-${String(result.timedOut ?? false)}-${pileCardCount}`;

    if (lastRunKeyRef.current === runKey) return;

    const schedule = () => {
      /** `true` iff challenger caught a bluff on the challenged attribute (`isChallengeCorrect`). */
      const bluffCaught = result.challengeCorrect;
      const challengerIsLocal = result.challengerId === localPlayerId;
      const declarerIsLocal = result.playerId === localPlayerId;
      const tracks: FlightTrack[] = [];
      const nPile = pileGhostCount(pileCardCount);

      if (bluffCaught) {
        if (challengerIsLocal) {
          const roundEl = roundPileRailRef.current;
          if (roundEl) {
            const from = rectCenter(roundEl);
            let to: { x: number; y: number };
            if (typeof document !== "undefined") {
              const pool = document.getElementById(GAME_PLAYER_WON_PILE_ANCHOR_ID);
              to = pool ? rectCenter(pool) : fallbackWonPoolPoint();
            } else {
              to = fallbackWonPoolPoint();
            }
            tracks.push({
              trackKey: `${runKey}-challenger-wins-pile`,
              kind: "backs",
              from,
              to,
              count: nPile,
            });
          }
        }
      } else {
        if (challengerIsLocal) {
          const drawEl = drawStackRef.current;
          if (drawEl) {
            const from = rectCenter(drawEl);
            let to: { x: number; y: number };
            if (typeof document !== "undefined") {
              const hand = document.getElementById(GAME_PLAYER_HAND_ANCHOR_ID);
              to = hand ? rectCenter(hand) : fallbackRecipientPoint();
            } else {
              to = fallbackRecipientPoint();
            }
            const drawCount = PENALTY_DRAW_COUNT;
            const drawnCards =
              snapshotDrawn && snapshotDrawn.length === drawCount ? snapshotDrawn : null;
            tracks.push({
              trackKey: `${runKey}-challenger-penalty-draw`,
              kind: "draw",
              from,
              to,
              count: drawCount,
              drawnCards,
            });
          }
        } else if (declarerIsLocal) {
          const roundEl = roundPileRailRef.current;
          if (roundEl) {
            const from = rectCenter(roundEl);
            let to: { x: number; y: number };
            if (typeof document !== "undefined") {
              const pool = document.getElementById(GAME_PLAYER_WON_PILE_ANCHOR_ID);
              to = pool ? rectCenter(pool) : fallbackWonPoolPoint();
            } else {
              to = fallbackWonPoolPoint();
            }
            tracks.push({
              trackKey: `${runKey}-declarer-wins-pile`,
              kind: "backs",
              from,
              to,
              count: nPile,
            });
          }
        }
      }

      lastRunKeyRef.current = runKey;
      if (reducedMotion || tracks.length === 0) {
        setBundle(null);
        return;
      }
      setBundle({ bundleKey: runKey, tracks });
    };

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(schedule);
    });
    return () => cancelAnimationFrame(id);
  }, [phase, penaltyFxSnapshot, localPlayerId, reducedMotion, drawStackRef, roundPileRailRef]);

  useLayoutEffect(() => {
    if (!bundle || reducedMotion) return;
    const ms = clearMsForBundle(bundle.tracks);
    const t = window.setTimeout(() => setBundle(null), ms);
    return () => window.clearTimeout(t);
  }, [bundle, reducedMotion]);

  if (typeof document === "undefined" || !bundle || reducedMotion) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 perspective-[720px]"
      style={{ zIndex: ROUND_RESOLUTION_FX_Z }}
      aria-hidden
    >
      {bundle.tracks.map((track) =>
        track.kind === "backs" ? (
          <BacksFlightLayer key={track.trackKey} track={track} />
        ) : (
          <Fragment key={track.trackKey}>
            {Array.from({ length: track.count }).map((_, i) => (
              <PenaltyDrawFlightCard
                key={`${track.trackKey}-d-${i}`}
                card={track.drawnCards?.[i]}
                index={i}
                from={track.from}
                dx={track.to.x - track.from.x}
                dy={track.to.y - track.from.y}
                shouldFlipFace={track.drawnCards != null && track.drawnCards.length === track.count}
              />
            ))}
          </Fragment>
        ),
      )}
    </div>,
    document.body,
  );
}
