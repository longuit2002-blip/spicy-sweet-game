# LiveKit Cloud Free Setup Guide

This project uses LiveKit as the SFU/media layer. Default recommendation is **LiveKit Cloud Free**.

---

## 1. Create LiveKit Cloud Project

1. Create a LiveKit Cloud account.
2. Create one project for this game.
3. Copy the project values:
   - LiveKit URL (`wss://...`)
   - API key
   - API secret

---

## 2. Configure API Environment

Set in `apps/api/.env`:

```env
LIVEKIT_URL=wss://<your-project>.livekit.cloud
LIVEKIT_API_KEY=<your_livekit_api_key>
LIVEKIT_API_SECRET=<your_livekit_api_secret>
```

Also ensure:

```env
CLIENT_URL=http://localhost:3000
REDIS_URL=redis://127.0.0.1:6379
```

`POST /media/token` returns `503` when LiveKit env vars are missing.

---

## 3. Configure Web Environment

Set in `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_LIVEKIT_ENABLED=true
```

If you want to disable media UI explicitly:

```env
NEXT_PUBLIC_LIVEKIT_ENABLED=false
```

---

## 4. Local Validation

1. Start Redis.
2. Start API (`pnpm dev:api`).
3. Start web (`pnpm dev:web`).
4. Join a room with two browsers.
5. Toggle mic/camera and verify remote audio/video.

Expected behavior:

- `POST /media/token` succeeds for authenticated human room members.
- Bots cannot get media tokens.
- If media fails, gameplay/chat still works.

---

## 5. Cost/Usage Guidance (Project Mode)

Use LiveKit Cloud Free as long as project limits are not exceeded. For a side project:

1. Keep only one shared project environment.
2. Avoid long idle rooms.
3. Disable media for non-testing environments via `NEXT_PUBLIC_LIVEKIT_ENABLED=false`.
