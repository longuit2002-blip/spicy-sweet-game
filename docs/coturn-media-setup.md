# Coturn Media Setup (Deprecated)

This document is kept only for historical context.

As of 2026-04-05, this repo no longer uses custom P2P WebRTC signaling with Coturn as the default architecture.

Current direction:

1. Media transport uses **LiveKit Cloud Free** (SFU).
2. API issues media access tokens via `POST /media/token`.
3. Legacy `webrtc:*` Socket.IO signaling events are removed.

Use these docs instead:

- `docs/technical-design/sweet-spicy-game/tdd.md`
- `docs/technical-design/sweet-spicy-game/livekit-cloud-setup.md`
- `docs/technical-design/sweet-spicy-game/media-migration-livekit-cutover.md`
