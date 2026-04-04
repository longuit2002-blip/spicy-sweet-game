import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeFanOverlapPx, fanWidthPx } from "./PlayerHand";
import {
  PLAYER_HAND_FAN_MAX_OVERLAP_PX,
  PLAYER_HAND_FAN_MIN_VISIBLE_PX,
  PLAYER_HAND_CARD_WIDTH_MIN_PX,
  PLAYER_HAND_CARD_WIDTH_WIDE_PX,
  PLAYER_HAND_CARD_WIDTH_NARROW_PX,
  PLAYER_HAND_STRIP_BLEND_LOW_PX,
  PLAYER_HAND_STRIP_BLEND_HIGH_PX,
  handCardWidthFromStripPx,
} from "@/lib/game-room.constants";

/**
 * Feature: mobile-responsive-pwa, Property 1: Fan overlap giữ fan trong container
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * For any card count (1–20), valid card width, and positive container width,
 * computeFanOverlapPx must return an overlap such that the resulting fan width
 * does not exceed the container, OR the overlap has reached its maximum.
 */
describe("Property 1: Fan overlap giữ fan trong container", () => {
  it("fan width does not exceed container OR overlap is at max", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: PLAYER_HAND_CARD_WIDTH_MIN_PX, max: PLAYER_HAND_CARD_WIDTH_WIDE_PX }),
        fc.integer({ min: 200, max: 800 }),
        (cardCount, cardWidthPx, containerWidth) => {
          const overlap = computeFanOverlapPx(cardCount, cardWidthPx, containerWidth);
          const width = fanWidthPx(cardCount, cardWidthPx, overlap);

          const tightMax = Math.min(
            PLAYER_HAND_FAN_MAX_OVERLAP_PX,
            cardWidthPx - PLAYER_HAND_FAN_MIN_VISIBLE_PX,
          );

          // The overlap is computed with Math.round, so the fan may exceed the
          // container by at most 1px per inter-card gap due to rounding.
          const roundingTolerance = cardCount > 1 ? cardCount - 1 : 0;

          // Either the fan fits (within rounding tolerance), or overlap has reached its maximum
          expect(
            width <= containerWidth + roundingTolerance || overlap >= tightMax,
          ).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Feature: mobile-responsive-pwa, Property 2: Card width nằm trong khoảng hợp lệ theo strip width
 *
 * **Validates: Requirements 1.3**
 *
 * For any positive stripInnerWidthPx, handCardWidthFromStripPx must return a value
 * in [MIN_PX, WIDE_PX]. At boundary conditions: <= BLEND_LOW → NARROW_PX,
 * >= BLEND_HIGH → WIDE_PX.
 */
describe("Property 2: Card width nằm trong khoảng hợp lệ theo strip width", () => {
  it("output is always within [MIN_PX, WIDE_PX]", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (stripWidth) => {
          const result = handCardWidthFromStripPx(stripWidth);
          expect(result).toBeGreaterThanOrEqual(PLAYER_HAND_CARD_WIDTH_MIN_PX);
          expect(result).toBeLessThanOrEqual(PLAYER_HAND_CARD_WIDTH_WIDE_PX);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("returns NARROW_PX when stripWidth <= BLEND_LOW", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: PLAYER_HAND_STRIP_BLEND_LOW_PX }),
        (stripWidth) => {
          const result = handCardWidthFromStripPx(stripWidth);
          expect(result).toBe(PLAYER_HAND_CARD_WIDTH_NARROW_PX);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns WIDE_PX when stripWidth >= BLEND_HIGH", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: PLAYER_HAND_STRIP_BLEND_HIGH_PX, max: 2000 }),
        (stripWidth) => {
          const result = handCardWidthFromStripPx(stripWidth);
          expect(result).toBe(PLAYER_HAND_CARD_WIDTH_WIDE_PX);
        },
      ),
      { numRuns: 100 },
    );
  });
});
