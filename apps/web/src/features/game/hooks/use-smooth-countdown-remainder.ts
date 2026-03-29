"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Between server integer ticks, linearly decreases remaining time so progress bars move smoothly.
 */
export function useSmoothCountdownRemainder(timeLeftSeconds: number, reducedMotion: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  const tickStartRef = useRef(Date.now());
  const prevTimeRef = useRef(timeLeftSeconds);

  useEffect(() => {
    if (prevTimeRef.current !== timeLeftSeconds) {
      tickStartRef.current = Date.now();
      prevTimeRef.current = timeLeftSeconds;
    }
  }, [timeLeftSeconds]);

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  const elapsed = reducedMotion ? 0 : (now - tickStartRef.current) / 1000;
  if (timeLeftSeconds <= 0) return 0;
  const raw = timeLeftSeconds - elapsed;
  /** Do not drift below server second until the next tick (handles delayed socket updates). */
  return Math.max(timeLeftSeconds - 1, Math.max(0, raw));
}
