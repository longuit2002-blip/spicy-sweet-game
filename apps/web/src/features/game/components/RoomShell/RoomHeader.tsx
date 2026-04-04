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
        "fixed top-0 left-0 z-50 flex w-full items-center justify-between rounded-b-[1.75rem] bg-background px-4 py-2 shadow-[0_8px_20px_hsl(var(--primary)/0.08)] sm:rounded-b-[3rem] sm:px-6 sm:py-3",
        className,
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="text-xl font-black text-primary italic font-headline tracking-wide sm:text-2xl">
          Spicy!
        </span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="text-foreground hover:scale-110 transition-transform duration-300 p-1.5 rounded-full hover:bg-surface-container-high sm:p-2"
          aria-label="Help"
        >
          <Icon name="help" size={20} className="text-xl" />
        </button>
        <button
          type="button"
          className="text-foreground hover:scale-110 transition-transform duration-300 p-1.5 rounded-full hover:bg-surface-container-high sm:p-2"
          aria-label="Settings"
        >
          <Icon name="settings" size={20} className="text-xl" />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center border-2 border-primary overflow-hidden shadow-sm sm:w-10 sm:h-10">
          <span className="text-sm font-bold text-primary">
            {localPlayerNickname?.[0]?.toUpperCase() ?? "?"}
          </span>
        </div>
      </div>
    </header>
  );
}
