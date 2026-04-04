"use client";

import { useRoomMediaSession } from "@/features/social/media/room-media-session";

export function useWebRTC() {
  return useRoomMediaSession();
}
