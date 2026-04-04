# Coturn Media Setup

This project uses native WebRTC with Socket.IO signaling.

For local development, the API falls back to Google STUN:

- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`

For production, configure Coturn on the API only. Do not expose TURN credentials through `NEXT_PUBLIC_*`.

## Required API env

Set these in `apps/api/.env` or your deployment environment:

```env
WEBRTC_STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
WEBRTC_TURN_URLS=turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp
WEBRTC_TURN_USERNAME=your-turn-username
WEBRTC_TURN_CREDENTIAL=your-turn-password
```

## Coturn notes

- Open the TURN ports your deployment requires, usually `3478/udp`, `3478/tcp`, and `5349/tcp`.
- Use a public DNS name that browsers can reach from outside your VPC.
- Prefer TLS-enabled `turns:` URLs for restrictive networks.
- Keep credentials server-side and rotate them if they are shared beyond the team.

## Verification checklist

- Two browsers on the same LAN connect with STUN only.
- Two browsers on different or restrictive networks still connect through TURN.
- Restarting a tab causes the room media session to reconnect and rebuild peers.
