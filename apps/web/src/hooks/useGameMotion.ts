"use client";

import { useReducedMotion } from "framer-motion";
import type { Transition, Variants } from "framer-motion";
import {
  MODAL_CONTENT,
  MODAL_CONTENT_REDUCED,
  PHASE_TRANSITION,
  PHASE_TRANSITION_REDUCED,
  PHASE_VARIANTS,
  PHASE_VARIANTS_REDUCED,
  STAGGER_ITEM,
  STAGGER_ITEM_REDUCED,
} from "@/features/game/animations";

export function useGamePhaseVariants(): Variants {
  const reduced = useReducedMotion();
  return reduced ? PHASE_VARIANTS_REDUCED : PHASE_VARIANTS;
}

export function usePhaseTransition(): Transition {
  const reduced = useReducedMotion();
  return reduced ? PHASE_TRANSITION_REDUCED : PHASE_TRANSITION;
}

export function useModalVariants(): Variants {
  const reduced = useReducedMotion();
  return reduced ? MODAL_CONTENT_REDUCED : MODAL_CONTENT;
}

export function useStaggerItemVariants(): Variants {
  const reduced = useReducedMotion();
  return reduced ? STAGGER_ITEM_REDUCED : STAGGER_ITEM;
}

export { useReducedMotion };
