"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Between server integer ticks, linearly decreases remaining time so progress bars move smoothly.
 */
export function useSmoothCountdownRemainder(timeLeftSeconds: number, reducedMotion: boolean): number {
  const [now, setNow] = useState(0);
  const [tickStartAt, setTickStartAt] = useState(0);
  const tickStartRef = useRef(0);
  const prevTimeRef = useRef(timeLeftSeconds);

  useEffect(() => {
    if (prevTimeRef.current !== timeLeftSeconds) {
      const nextTickStart = reducedMotion ? 0 : Date.now();
      tickStartRef.current = nextTickStart;
      setTickStartAt(nextTickStart);
      setNow(nextTickStart);
      prevTimeRef.current = timeLeftSeconds;
    }
  }, [reducedMotion, timeLeftSeconds]);

  useEffect(() => {
    if (reducedMotion) {
      tickStartRef.current = 0;
      setTickStartAt(0);
      setNow(0);
      return;
    }

    const initialNow = Date.now();
    tickStartRef.current = initialNow;
    setTickStartAt(initialNow);
    setNow(initialNow);

    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  const elapsed = reducedMotion || tickStartAt === 0 ? 0 : (now - tickStartAt) / 1000;
  if (timeLeftSeconds <= 0) return 0;
  const raw = timeLeftSeconds - elapsed;
  /** Do not drift below server second until the next tick (handles delayed socket updates). */
  return Math.max(timeLeftSeconds - 1, Math.max(0, raw));
}
