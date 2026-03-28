"use client";

import { type HTMLAttributes, type Ref, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  /** Material Symbols icon name, e.g. "add_circle", "play_circle" */
  name: string;
  /** Optical size (opsz) — any number is valid */
  size?: number;
  /** FILL weight: 0 = outlined, 1 = filled */
  fill?: 0 | 1;
  /** Additional className */
  className?: string;
}

const VARIATION_SETTINGS = (fill: 0 | 1, size: number) =>
  `'FILL' ${fill}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`;

const Icon = forwardRef(function Icon(
  { name, size = 24, fill = 0, className, ...props }: IconProps,
  ref: Ref<HTMLSpanElement>,
) {
  return (
    <span
      ref={ref}
      className={cn("material-symbols-outlined select-none leading-none", className)}
      style={{ fontVariationSettings: VARIATION_SETTINGS(fill, size) }}
      aria-hidden="true"
      {...props}
    >
      {name}
    </span>
  );
});

export { Icon };
