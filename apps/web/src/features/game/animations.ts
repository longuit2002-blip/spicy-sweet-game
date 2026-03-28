import type { Transition, Variants } from "framer-motion";

/** Antigravity-style ease-out floor for non-spring tweens (≈0.35s perceived). */
export const PHASE_EASE_OUT: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

export const PHASE_DURATION_SECONDS = 0.4;
export const PHASE_DURATION_REDUCED_SECONDS = 0.28;

export const PHASE_TRANSITION: Transition = {
  type: "tween",
  duration: PHASE_DURATION_SECONDS,
  ease: PHASE_EASE_OUT,
};

export const PHASE_TRANSITION_REDUCED: Transition = {
  type: "tween",
  duration: PHASE_DURATION_REDUCED_SECONDS,
  ease: PHASE_EASE_OUT,
};

/** Subtle Z rotation (degrees) for phase strip spatial depth. */
export const PHASE_ROTATE_Z_DEG = 1.2;

/** Short press feedback for gameplay buttons (transform-only). */
export const TAP_FEEDBACK_TRANSITION: Transition = {
  type: "tween",
  duration: 0.18,
  ease: PHASE_EASE_OUT,
};

/** Spring tuned for card/table motion (taste-skill MOTION_INTENSITY ~6). */
export const CARD_SPRING: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 25,
};

/** Softer spring for hand cards — slightly “floatier” antigravity feel. */
export const FLOAT_SPRING: Transition = {
  type: "spring",
  stiffness: 165,
  damping: 22,
};

export const SNAPPY_SPRING: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

/** Delay between each penalty pile card “flight” from the draw-pile side (seconds). */
export const PENALTY_PILE_DRAW_FLIGHT_STAGGER_SECONDS = 0.055;

/** Off-screen start for penalty cards (toward duel draw column, viewport coords). */
export const PENALTY_PILE_DRAW_FLIGHT_INITIAL_X_PX = 72;
export const PENALTY_PILE_DRAW_FLIGHT_INITIAL_Y_PX = -56;
export const PENALTY_PILE_DRAW_FLIGHT_INITIAL_SCALE = 0.86;

/** Face-down claim card lands from below toward the center (table play). */
export const PLAY_CARD_TO_TABLE_SPRING: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 19,
  mass: 0.72,
};

export const PHASE_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 22,
    rotateZ: -PHASE_ROTATE_Z_DEG,
    scale: 0.985,
  },
  animate: {
    opacity: 1,
    y: 0,
    rotateZ: 0,
    scale: 1,
  },
  exit: {
    opacity: 0,
    y: -14,
    rotateZ: PHASE_ROTATE_Z_DEG * 0.65,
    scale: 0.988,
  },
};

export const PHASE_VARIANTS_REDUCED: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Stagger for lists (phase chips, containers): ~0.1s between siblings. */
export const STAGGER_CHILD_DELAY_SECONDS = 0.1;
/** Hand fan card entrance delay — matches v0 export `b_bGZjY0BUm3B` snappy stagger. */
export const HAND_STAGGER_CHILD_DELAY_SECONDS = 0.05;
export const STAGGER_CONTAINER_DELAY_CHILDREN_SECONDS = 0.05;

export const STAGGER_CONTAINER: Variants = {
  initial: { opacity: 1 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: STAGGER_CHILD_DELAY_SECONDS,
      delayChildren: STAGGER_CONTAINER_DELAY_CHILDREN_SECONDS,
    },
  },
};

export const STAGGER_ITEM: Variants = {
  initial: { opacity: 0, y: 18, rotateZ: -0.8 },
  animate: { opacity: 1, y: 0, rotateZ: 0 },
};

export const STAGGER_ITEM_REDUCED: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

/** Spring preset for hand wrapper `animate` entry (v0 export PlayerHand). */
export const HAND_FAN_FLOAT_SPRING: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

/**
 * Hand strip: lift + scale on wrapper `motion.div` (v0 export); inner {@link SpiceCard} uses brightness + glow only.
 * `hovered` / `dragging` must keep `opacity: 1` so a root-level `transition.delay` cannot drive opacity back toward `initial`.
 */
export const STAGGER_ITEM_HAND: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.9 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: HAND_FAN_FLOAT_SPRING,
  },
  hovered: {
    opacity: 1,
    y: -10,
    scale: 1.04,
    transition: {
      type: "spring",
      stiffness: 420,
      damping: 26,
      mass: 0.6,
    },
  },
  dragging: {
    opacity: 1,
    scale: 1.08,
    y: -14,
    transition: {
      type: "spring",
      stiffness: 360,
      damping: 28,
      mass: 0.7,
    },
  },
};

export const STAGGER_ITEM_HAND_REDUCED: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  hovered: { opacity: 1, scale: 1.02, transition: { duration: 0.1 } },
  dragging: { opacity: 1, scale: 1.04, transition: { duration: 0.1 } },
};

/**
 * Per-card hand wrapper variants: entrance stagger delay only on `animate`, never on hover/drag transitions.
 */
export function staggerHandItemVariantsForIndex(index: number, reduced: boolean): Variants {
  if (reduced) {
    return STAGGER_ITEM_HAND_REDUCED;
  }
  return {
    initial: STAGGER_ITEM_HAND.initial,
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        ...HAND_FAN_FLOAT_SPRING,
        delay: index * HAND_STAGGER_CHILD_DELAY_SECONDS,
      },
    },
    hovered: STAGGER_ITEM_HAND.hovered,
    dragging: STAGGER_ITEM_HAND.dragging,
  };
}

/** In-hand selected card outer glow — theme primary (export used sky-400 rgba). */
export const HAND_SELECTION_GLOW: Variants = {
  selected: {
    opacity: 1,
    boxShadow: "0 0 18px 3px hsl(var(--primary) / 0.55)",
    transition: { duration: 0.25 },
  },
  unselected: {
    opacity: 1,
    boxShadow: "0 0 0px 0px hsl(var(--primary) / 0)",
    transition: { duration: 0.25 },
  },
};

export const HAND_CARD_HOVER = {
  y: -12,
  rotate: -2,
  transition: FLOAT_SPRING,
} as const;

export const HAND_CARD_SELECTED = {
  y: -24,
  transition: SNAPPY_SPRING,
} as const;

export const TROPHY_BOUNCE: Variants = {
  initial: { scale: 0.85, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: SNAPPY_SPRING,
  },
};

export const OVERLAY_BACKDROP: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const MODAL_CONTENT: Variants = {
  initial: { scale: 0.94, opacity: 0, y: 12 },
  animate: { scale: 1, opacity: 1, y: 0 },
  exit: { scale: 0.96, opacity: 0, y: 8 },
};

export const MODAL_CONTENT_REDUCED: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};
