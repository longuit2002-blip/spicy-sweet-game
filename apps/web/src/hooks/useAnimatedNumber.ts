"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const SCORE_COUNT_UP_MS = 700;

/**
 * Counts from `from` to `to` over a short duration. Respects reduced motion (jumps to `to`).
 */
export function useAnimatedNumber(to: number, from = 0, enabled = true): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : from);

  useEffect(() => {
    if (!enabled) {
      setValue(to);
      return;
    }
    if (reduced) {
      setValue(to);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const delta = to - from;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SCORE_COUNT_UP_MS);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + delta * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, from, enabled, reduced]);

  return value;
}
