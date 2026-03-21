import { Suspense } from "react";
import { GameRoomClient } from "./game-room-client";

export default function RoomPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <GameRoomClient />
    </Suspense>
  );
}
