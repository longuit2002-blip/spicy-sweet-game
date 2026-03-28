"use client";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface RoomHeaderProps {
  localPlayerNickname?: string;
  className?: string;
}

export function RoomHeader({ localPlayerNickname, className }: RoomHeaderProps) {
  return (
    <header
      className={cn(
        "fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4 bg-background shadow-[0_8px_20px_hsl(343_40%_45%/0.08)] rounded-b-[3rem]",
        className,
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="text-2xl font-black text-primary italic font-headline tracking-wide">
          Spicy!
        </span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="text-foreground hover:scale-110 transition-transform duration-300 p-2 rounded-full hover:bg-surface-container-high"
          aria-label="Help"
        >
          <Icon name="help" size={20} className="text-xl" />
        </button>
        <button
          type="button"
          className="text-foreground hover:scale-110 transition-transform duration-300 p-2 rounded-full hover:bg-surface-container-high"
          aria-label="Settings"
        >
          <Icon name="settings" size={20} className="text-xl" />
        </button>
        <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center border-2 border-primary overflow-hidden shadow-sm">
          <span className="text-sm font-bold text-primary">
            {localPlayerNickname?.[0]?.toUpperCase() ?? "?"}
          </span>
        </div>
      </div>
    </header>
  );
}
