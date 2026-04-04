import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/* ------------------------------------------------------------------ */
/*  Mocks — must be declared before the component import               */
/* ------------------------------------------------------------------ */

// Track which mobile value the hook should return
let mockIsMobile = false;

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockIsMobile,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("@/lib/i18n", () => ({
  changeLanguage: vi.fn(),
}));

// Minimal framer-motion mock — render children directly
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const safeProps: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          safeProps[k] = v;
        }
        if (k === "className" || k === "onClick" || k === "style") {
          safeProps[k] = v;
        }
      }
      return <div {...safeProps}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

import { DeclareDialog } from "./DeclareDialog";

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("DeclareDialog — mobile vs desktop rendering", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    card: { id: "c1", type: "chili" as const, number: 3, kind: "spice" as const },
    onDeclare: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Drawer (vaul) on mobile", () => {
    mockIsMobile = true;
    render(<DeclareDialog {...defaultProps} />);

    // vaul Drawer renders via portal into document.body — query from document
    // DrawerContent has the game-glass-panel + rounded-t-3xl classes
    const drawerContent = document.querySelector(".game-glass-panel.rounded-t-3xl");
    expect(drawerContent).not.toBeNull();

    // Should NOT render the desktop motion.div modal backdrop
    const desktopBackdrop = document.querySelector(".backdrop-blur-md");
    expect(desktopBackdrop).toBeNull();
  });

  it("renders centered modal on desktop", () => {
    mockIsMobile = false;
    render(<DeclareDialog {...defaultProps} />);

    // Desktop modal uses backdrop-blur-md class on the overlay
    const desktopBackdrop = document.querySelector(".backdrop-blur-md");
    expect(desktopBackdrop).not.toBeNull();

    // Should NOT render the Drawer bottom sheet (game-glass-panel + rounded-t-3xl combo)
    const drawerContent = document.querySelector(".game-glass-panel.rounded-t-3xl");
    expect(drawerContent).toBeNull();
  });

  it("does not render anything on desktop when open=false", () => {
    mockIsMobile = false;
    render(<DeclareDialog {...defaultProps} open={false} />);

    expect(document.querySelector(".backdrop-blur-md")).toBeNull();
    expect(document.querySelector(".game-glass-panel.rounded-t-3xl")).toBeNull();
  });
});
