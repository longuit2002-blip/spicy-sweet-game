import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Max viewport height (px) that still counts as "mobile" even when width exceeds
 * {@link MOBILE_BREAKPOINT}. Covers landscape phones (e.g. iPhone 12 Pro landscape = 844×390).
 */
const LANDSCAPE_MOBILE_MAX_HEIGHT = 500;

/**
 * Returns `true` when the viewport is a phone-class screen:
 * - Portrait: width < 768px (standard Tailwind `md` breakpoint)
 * - Landscape: height ≤ 500px (phone held sideways — width may exceed 768px but height is tiny)
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const check = () => {
      const narrow = window.innerWidth < MOBILE_BREAKPOINT;
      const landscapePhone =
        window.innerHeight <= LANDSCAPE_MOBILE_MAX_HEIGHT &&
        window.innerWidth >= MOBILE_BREAKPOINT;
      setIsMobile(narrow || landscapePhone);
    };

    // Listen to both width and height changes (orientation flip, resize)
    const mqlWidth = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const mqlHeight = window.matchMedia(`(max-height: ${LANDSCAPE_MOBILE_MAX_HEIGHT}px)`);

    mqlWidth.addEventListener("change", check);
    mqlHeight.addEventListener("change", check);
    check();

    return () => {
      mqlWidth.removeEventListener("change", check);
      mqlHeight.removeEventListener("change", check);
    };
  }, []);

  return !!isMobile;
}

/**
 * Returns `true` specifically when the device is a phone in landscape orientation
 * (width ≥ 768px but height ≤ 500px). Useful for layout adjustments that only apply
 * to landscape phones, not portrait mobile or desktop.
 */
export function useIsLandscapeMobile() {
  const [isLandscape, setIsLandscape] = React.useState(false);

  React.useEffect(() => {
    const check = () => {
      setIsLandscape(
        window.innerWidth >= MOBILE_BREAKPOINT &&
          window.innerHeight <= LANDSCAPE_MOBILE_MAX_HEIGHT,
      );
    };

    const mql = window.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-height: ${LANDSCAPE_MOBILE_MAX_HEIGHT}px)`,
    );
    mql.addEventListener("change", check);
    check();

    return () => mql.removeEventListener("change", check);
  }, []);

  return isLandscape;
}
