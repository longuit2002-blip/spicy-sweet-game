"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  GAME_CARD_BACK_SRC,
  GAME_CARD_CORNER_CLASS,
  GAME_CARD_CORNER_LG_CLASS,
  GAME_CARD_CORNER_SQUARE_CLASS,
} from "@/lib/game-card-assets";

type CardBackSurfaceProps = {
  className?: string;
  /** Default: hand-sized corner; `lg` matches tableau / claim stacks; `square` = full-bleed back art. */
  corner?: "default" | "lg" | "square";
  /** When false, only the art + radius (parent supplies border/shadow). */
  framed?: boolean;
};

/**
 * Face-down card surface using `/public` art ({@link GAME_CARD_BACK_SRC}).
 */
export function CardBackSurface({ className, corner = "default", framed = true }: CardBackSurfaceProps) {
  const r =
    corner === "square"
      ? GAME_CARD_CORNER_SQUARE_CLASS
      : corner === "lg"
        ? GAME_CARD_CORNER_LG_CLASS
        : GAME_CARD_CORNER_CLASS;
  const frameClass =
    framed &&
    (corner === "square"
      ? "border-0 bg-transparent shadow-md sm:shadow-lg"
      : "border-2 border-card-back/90 bg-card-back shadow-card");
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        r,
        frameClass,
        className,
      )}
    >
      <Image
        src={GAME_CARD_BACK_SRC}
        alt=""
        fill
        unoptimized
        className="object-cover"
        sizes="(max-width: 640px) 96px, 128px"
      />
    </div>
  );
}
