import { Suspense } from "react";
import { HomeClient } from "./home-client";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center">Loading…</div>}>
      <HomeClient />
    </Suspense>
  );
}
