"use client";

import { Icon } from "@/components/ui/icon";
import { useRoomMediaSessionStatusState } from "@/features/social/media/room-media-session";
import { cn } from "@/lib/utils";

export interface MobileChatFABProps {
  onClick: () => void;
  label: string;
  /** When true, show a small indicator that the voice/video session is active. */
  mediaSessionActive?: boolean;
}

export function MobileChatFAB({ onClick, label, mediaSessionActive = false }: MobileChatFABProps) {
  return (
    <button
      type="button"
      className={cn(
        "fixed right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-110 xl:hidden",
        "bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))]",
      )}
      onClick={onClick}
      aria-label={label}
    >
      {mediaSessionActive ? (
        <span
          className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-emerald-400"
          aria-hidden
        />
      ) : null}
      <Icon name="chat" size={24} fill={1} className="text-2xl" />
    </button>
  );
}

/** FAB wired to room media session — must render under `RoomMediaSessionProvider`. */
export function MobileChatFABWithMediaSession(props: Omit<MobileChatFABProps, "mediaSessionActive">) {
  const { isJoined } = useRoomMediaSessionStatusState();
  return <MobileChatFAB {...props} mediaSessionActive={isJoined} />;
}
