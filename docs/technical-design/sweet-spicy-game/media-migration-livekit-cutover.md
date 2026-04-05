# Media Migration Note: Custom WebRTC -> LiveKit

Date: 2026-04-05

This document records removal of legacy custom WebRTC signaling and migration to LiveKit.

---

## Removed Socket.IO Events

The following events are removed from shared contracts and gateway handlers:

- `webrtc:join-room`
- `webrtc:leave-room`
- `webrtc:update-media-state`
- `webrtc:offer`
- `webrtc:answer`
- `webrtc:ice-candidate`

Any client code still depending on these events must be deleted.

---

## New Media Flow

1. Client joins app room via existing auth + Socket.IO.
2. Client calls `POST /media/token` with JWT and `roomCode`.
3. API validates room membership and bot restriction.
4. API returns LiveKit token payload.
5. Client connects to LiveKit room and manages tracks via LiveKit SDK events.

---

## Identity Mapping

Single identity key across systems:

- app JWT user id
- Socket.IO session user id
- room player id
- LiveKit participant identity

No parallel identity model is introduced.

---

## Operational Impact

- Media transport no longer depends on Socket.IO signaling handlers.
- Gameplay/chat remain on Socket.IO unchanged.
- Redis and PostgreSQL responsibilities are unchanged by this media cutover:
  - Redis = active room/session state + pub/sub.
  - PostgreSQL = durable user/history data.
