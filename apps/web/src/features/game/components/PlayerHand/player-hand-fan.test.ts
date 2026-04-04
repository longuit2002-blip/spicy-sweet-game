import { describe, it, expect } from "vitest";
import { computeFanOverlapPx, fanWidthPx } from "./PlayerHand";
import {
  PLAYER_HAND_FAN_LOOSE_OVERLAP_PX,
  PLAYER_HAND_FAN_MIN_VISIBLE_PX,
  PLAYER_HAND_CARD_WIDTH_NARROW_PX,
  PLAYER_HAND_CARD_WIDTH_WIDE_PX,
  PLAYER_HAND_CARD_WIDTH_MIN_PX,
  handCardWidthFromStripPx,
} from "@/lib/game-room.constants";

/**
 * Unit test: edge cases — PlayerHand with 0/1/20 cards,
 * handCardWidthFromStripPx with stripWidth=0
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */
describe("fanWidthPx — edge cases", () => {
  it("returns 0 for 0 cards", () => {
    expect(fanWidthPx(0, 100, 20)).toBe(0);
  });

  it("returns cardWidthPx for 1 card (no overlap)", () => {
    expect(fanWidthPx(1, 100, 20)).toBe(100);
  });

  it("computes correctly for 20 cards", () => {
    const cardWidth = 92;
    const overlap = 30;
    // 20 * 92 - 19 * 30 = 1840 - 570 = 1270
    expect(fanWidthPx(20, cardWidth, overlap)).toBe(1270);
  });
});

describe("computeFanOverlapPx — edge cases", () => {
  it("returns 0 for 0 cards", () => {
    expect(computeFanOverlapPx(0, 100, 400)).toBe(0);
  });

  it("returns 0 for 1 card", () => {
    expect(computeFanOverlapPx(1, 100, 400)).toBe(0);
  });

  it("returns loose overlap when fan fits easily (2 cards, wide container)", () => {
    const cardWidth = 92;
    const container = 800;
    const overlap = computeFanOverlapPx(2, cardWidth, container);
    const expectedLoose = Math.min(
      PLAYER_HAND_FAN_LOOSE_OVERLAP_PX,
      cardWidth - PLAYER_HAND_FAN_MIN_VISIBLE_PX,
    );
    expect(overlap).toBe(expectedLoose);
  });

  it("increases overlap for 20 cards in a narrow container", () => {
    const cardWidth = 92;
    const narrowContainer = 300;
    const overlap = computeFanOverlapPx(20, cardWidth, narrowContainer);
    // With 20 cards in 300px, overlap must be higher than loose
    expect(overlap).toBeGreaterThan(PLAYER_HAND_FAN_LOOSE_OVERLAP_PX);
  });

  it("returns loose overlap when containerInnerWidthPx is 0", () => {
    const cardWidth = 92;
    const overlap = computeFanOverlapPx(5, cardWidth, 0);
    const expectedLoose = Math.min(
      PLAYER_HAND_FAN_LOOSE_OVERLAP_PX,
      cardWidth - PLAYER_HAND_FAN_MIN_VISIBLE_PX,
    );
    expect(overlap).toBe(expectedLoose);
  });
});

describe("handCardWidthFromStripPx — edge cases", () => {
  it("returns NARROW_PX for stripWidth=0", () => {
    expect(handCardWidthFromStripPx(0)).toBe(PLAYER_HAND_CARD_WIDTH_NARROW_PX);
  });

  it("returns NARROW_PX for negative stripWidth", () => {
    expect(handCardWidthFromStripPx(-100)).toBe(PLAYER_HAND_CARD_WIDTH_NARROW_PX);
  });

  it("returns a value >= MIN_PX for stripWidth=1", () => {
    const result = handCardWidthFromStripPx(1);
    expect(result).toBeGreaterThanOrEqual(PLAYER_HAND_CARD_WIDTH_MIN_PX);
  });

  it("returns WIDE_PX for very large stripWidth", () => {
    expect(handCardWidthFromStripPx(10000)).toBe(PLAYER_HAND_CARD_WIDTH_WIDE_PX);
  });
});
