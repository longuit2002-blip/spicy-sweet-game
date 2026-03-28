# Technical Design Document: Sweet & Spicy Online Card Game

> Technical Design Document for Sweet & Spicy Multiplayer Card Game
> Version: 2.0 | Date: 2026-03-21 | Status: Draft

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Frontend Design](#2-frontend-design)
3. [Backend Design](#3-backend-design)
4. [Real-Time Communication](#4-real-time-communication)
5. [Database Design](#5-database-design)
6. [WebRTC Design](#6-webrtc-design)
7. [Security Design](#7-security-design)
8. [Infrastructure & Deployment](#8-infrastructure--deployment)
9. [API Reference](#9-api-reference)
10. [Error Handling](#10-error-handling)
11. [Monitoring & Observability](#11-monitoring--observability)
12. [Appendix](#appendix)

---

## 1. Architecture Overview

### 1.1 System Context Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Web[Web Browser<br/>Next.js 16 App]
        Mobile[Mobile PWA<br/>same Next.js app]
    end

    subgraph "Application Layer"
        API[NestJS 10 Server<br/>REST + Socket.IO]
    end

    subgraph "Media Layer"
        STUN["Public STUN<br/>(Google)"]
        TURN["TURN Server<br/>(future: Coturn)"]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL 16<br/>User data)]
        Memory["In-Memory<br/>Room & Game State"]
    end

    Web --> API
    Mobile --> API
    API --> DB
    API --> Memory
    Web <-.-> STUN
    Web <-.-> TURN
```

The current architecture is a single-server deployment. The NestJS process hosts both the REST API and the Socket.IO gateway. Room and game state live in process memory; only user identity is persisted to PostgreSQL.

### 1.2 Technology Stack

| Layer | Technology | Version | Justification |
|---|---|---|---|
| **Monorepo** | Turborepo + pnpm workspaces | Turbo 2.x, pnpm 10.x | Parallel builds, shared packages, single lockfile |
| **Frontend** | Next.js (App Router) + React + TypeScript | Next 16, React 19, TS 5.x | SSR for initial load, App Router for file-based routing |
| **UI** | shadcn/ui + Tailwind CSS + Framer Motion | Tailwind 3.x, Framer 12.x | Accessible Radix primitives, utility-first styling, smooth animations |
| **State** | Zustand | 5.x | Lightweight, no boilerplate, `persist` middleware for auth |
| **Forms** | react-hook-form + Zod | RHF 7.x, Zod 3.x | Performant uncontrolled forms, shared schema validation |
| **Data fetching** | @tanstack/react-query | 5.x | Cache, refetch, loading/error states for REST calls |
| **i18n** | i18next + react-i18next | i18next 25.x | EN/VI support, namespace-scoped keys, SSR-safe init |
| **Real-time** | Socket.IO v4 | Client 4.8, Server 4.8 | WebSocket with polling fallback, rooms, typed events |
| **Video/Voice** | WebRTC (browser API) | — | Peer-to-peer, low latency, no media server needed for small rooms |
| **Backend** | NestJS + TypeScript | NestJS 10.x, TS 5.x | Modules, DI, guards, pipes, decorator-based Socket gateway |
| **ORM** | Prisma | 5.x | Type-safe queries, migrations, auto-generated client |
| **Database** | PostgreSQL | 16 | ACID, relational, mature ecosystem |
| **Auth** | JWT (Passport) | @nestjs/jwt 10.x | Stateless access tokens (15 min), refresh tokens (7 days) |

### 1.3 Architecture Principles

1. **Server-authoritative game logic** — all card play, challenge resolution, and scoring run on the server via pure functions in `@sweet-spicy/game-logic`. The client renders state it receives; it never computes outcomes.
2. **Event-driven real-time** — game actions flow through Socket.IO events, not REST polling. The server broadcasts `game:state-update` after every state mutation.
3. **Shared packages** — `@sweet-spicy/shared-types` defines all TypeScript interfaces and Socket event contracts once; `@sweet-spicy/game-logic` contains all pure game functions. Both apps import them as workspace dependencies.
4. **Optimistic UI** — the client can highlight a played card instantly, but waits for the server's `game:state-update` before advancing phase.
5. **Peer-to-peer media** — WebRTC for video/voice keeps media traffic off the server; Socket.IO is only used for signaling (offer/answer/ICE exchange).

### 1.4 Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Next.js over Vite SPA | Next.js 16 App Router | Faster initial page load via SSR, file-based routing, built-in image optimization. The game itself is a client component, but the lobby and landing page benefit from server rendering. |
| NestJS over Express | NestJS 10 | Module system prevents spaghetti as features grow; built-in Socket.IO adapter, validation pipes, and DI eliminate boilerplate. |
| In-memory state over Redis | `Map<string, ServerRoom>` | Simpler for single-server V1. Rooms are ephemeral (destroyed when empty). Redis is the planned migration path for multi-instance scaling (see §8.4). |
| Monorepo over polyrepo | Turborepo + pnpm | Game logic and types must stay in sync between frontend and backend. A single repo with workspace packages enforces that at build time. |
| WebRTC with public STUN | Google STUN, no TURN yet | Sufficient for players on non-symmetric NAT. A self-hosted Coturn TURN server is deferred to V1 when video/voice is prioritized. |

### 1.5 Assumptions and Constraints

- **Single server instance** for V1 (MVP). Horizontal scaling requires adding Redis for Socket.IO adapter and session/room state.
- **Guest-only auth** for now. Social login (Google, Facebook) is deferred to "Could Have" per PRD §7.
- **No game persistence** — if the server restarts, active games are lost. Acceptable for MVP; mitigated by short game duration (15–20 min).
- **Target**: 2–6 players per room, up to ~100 concurrent rooms on one server (see NFR-003 scaling plan in §8.4).

---

## 2. Frontend Design

### 2.1 Project Structure

```
apps/web/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Root layout (fonts, providers, html/body)
│   │   ├── page.tsx                # Landing — server component shell
│   │   ├── home-client.tsx         # Landing — client: nickname + create/join
│   │   ├── providers.tsx           # ThemeProvider, QueryClient, I18nextProvider
│   │   ├── globals.css             # Tailwind base + custom variables
│   │   ├── not-found.tsx
│   │   └── room/[code]/
│   │       ├── page.tsx            # Room — server component shell
│   │       └── game-room-client.tsx # Room — client: lobby + game + chat
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives (button, dialog, …)
│   │   └── game/                   # Assembled game widgets
│   │       ├── GameTable.tsx
│   │       ├── Scoreboard.tsx
│   │       ├── OpponentBar.tsx
│   │       ├── VideoPanel.tsx
│   │       └── RevealResult.tsx
│   ├── features/
│   │   ├── game/components/        # Feature-sliced game components
│   │   │   ├── SpiceCard/
│   │   │   ├── PlayerHand/
│   │   │   ├── GameTable/
│   │   │   ├── DeclareDialog/
│   │   │   ├── ChallengePhase/
│   │   │   ├── RevealResult/
│   │   │   ├── Scoreboard/
│   │   │   └── OpponentBar/
│   │   ├── video/VideoPanel/
│   │   └── chat/ChatPanel/
│   ├── hooks/
│   │   ├── useGameSocket.ts        # Socket.IO lifecycle + event wiring
│   │   ├── useWebRTC.ts            # WebRTC peer connections + media
│   │   ├── use-mobile.tsx          # Responsive breakpoint hook
│   │   └── use-toast.ts            # Toast notifications
│   ├── lib/
│   │   ├── i18n.ts                 # i18next init (EN/VI, no browser detector)
│   │   ├── socket-client.ts        # Socket.IO singleton
│   │   └── utils.ts                # cn() and misc helpers
│   ├── locales/
│   │   ├── en/                     # common.json, game.json
│   │   └── vi/                     # common.json, game.json
│   ├── shared/types/               # Local re-exports for convenience
│   │   ├── socket.ts
│   │   └── game.ts
│   └── stores/
│       ├── userStore.ts            # Auth state (persisted to localStorage)
│       ├── roomStore.ts            # Lobby players, connection status
│       ├── gameStore.ts            # Game state, selected card, timers
│       ├── chatStore.ts            # Chat messages
│       └── index.ts
├── next.config.ts                  # Aliases for workspace packages
├── tailwind.config.ts
└── package.json
```

### 2.2 Component Architecture

```mermaid
graph TD
    Layout[RootLayout<br/><i>server component</i>] --> Providers
    Providers --> Router

    Router --> HomePage["/ — HomeClient"]
    Router --> RoomPage["/room/[code] — GameRoomClient"]

    HomePage --> NicknameForm
    HomePage --> CreateRoom
    HomePage --> JoinRoom

    RoomPage --> LobbyView
    RoomPage --> GameView
    RoomPage --> ChatPanel
    RoomPage --> VideoPanel

    GameView --> OpponentBar
    GameView --> GameTable
    GameView --> PlayerHand
    GameView --> DeclareDialog
    GameView --> ChallengePhase
    GameView --> RevealResult
    GameView --> Scoreboard
```

#### Key Components

| Component | Responsibility | Key Props / Store |
|---|---|---|
| `HomeClient` | Nickname input, create/join room | `userStore`, `useGameSocket().createRoom/joinRoom` |
| `GameRoomClient` | Switches between lobby and active game views | `roomStore`, `gameStore`, `useGameSocket()` |
| `PlayerHand` | Renders the local player's cards, handles selection | `gameStore.myHand`, `setSelectedCard` |
| `DeclareDialog` | Modal to choose spice type + number for declaration | `selectedCardId`, `setSelectedDeclaration` |
| `ChallengePhase` | Countdown timer, Challenge / Accept buttons | `gameState.challengeTimer`, `challenge()`, `acceptDeclaration()` |
| `RevealResult` | Animated card flip showing bluff result | `gameState.challengeResult` |
| `Scoreboard` | Player scores + stats | `gameState.players` |
| `VideoPanel` | Local + remote video streams, mute/camera toggles | `useWebRTC()` |
| `ChatPanel` | Message list + input | `chatStore`, `sendChatMessage()` |

### 2.3 State Management

Four Zustand stores, each with a single responsibility:

```typescript
// stores/userStore.ts — persisted via zustand/persist
interface UserStore {
  user: { id: string; nickname: string } | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setUser, setTokens, setAccessToken, logout, initialize
}

// stores/roomStore.ts
interface RoomState {
  code: string | null;
  players: RoomPlayer[];
  isConnected: boolean;
  maxPlayers: number;
  setRoomCode, setPlayers, addPlayer, removePlayer, setPlayerReady, setConnected, reset
}

// stores/gameStore.ts
interface GameStore {
  gameState: GameState | null;
  selectedCardId: string | null;
  selectedDeclaration: Declaration | null;
  challengeTimeLeft: number;
  // derived: currentPlayer, isMyTurn, myHand, canChallenge
  setGameState, updateGameState, resetGameState,
  setSelectedCard, setSelectedDeclaration,
  setChallengeTimeLeft, decrementChallengeTimer
}

// stores/chatStore.ts
interface ChatState {
  messages: ChatMessage[];
  addMessage, setMessages, clearMessages
}
```

#### State Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as React Component
    participant Store as Zustand Store
    participant Socket as Socket.IO Client
    participant Server as NestJS Gateway

    User->>UI: Select card + declare
    UI->>Store: setSelectedCard, setSelectedDeclaration
    User->>UI: Click "Play"
    UI->>Socket: emit("game:play-card", { cardId, declaration })
    Socket->>Server: WebSocket message
    Server->>Server: playCard() — validate + mutate state
    Server->>Socket: broadcast("game:state-update", newState)
    Socket->>Store: updateGameState(newState)
    Store-->>UI: Re-render with CHALLENGE_PHASE
```

### 2.4 Socket.IO Client

```typescript
// lib/socket-client.ts
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";

let socketInstance: GameSocket | null = null;

export function createSocket(token?: string): GameSocket {
  if (socketInstance) socketInstance.disconnect();
  socketInstance = io(SOCKET_URL, {
    auth: token ? { token } : undefined,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });
  return socketInstance;
}
```

The `useGameSocket` hook calls `createSocket(accessToken)` on mount and wires all `ServerToClientEvents` to the corresponding store setters. On unmount it disconnects. Convenience methods (`joinRoom`, `createRoom`, `playCard`, `challenge`, `acceptDeclaration`, `sendChatMessage`) are returned for components to call.

### 2.5 i18n Strategy

- **Namespaces**: `common` (shared labels, navigation) and `game` (gameplay-specific strings).
- **Languages**: `en` (default), `vi`.
- **SSR safety**: No browser language detector at init. The server and client both start with `lng: "en"`. After hydration, `applyStoredOrBrowserLanguage()` reads `localStorage` or `navigator.language` and switches if Vietnamese is detected.
- **Key convention**: `t("lobby.title")` resolves within the current namespace. Cross-namespace access uses `t("key", { ns: "common" })`.

---

## 3. Backend Design

### 3.1 Server Architecture

```mermaid
graph TB
    subgraph "NestJS Application"
        Main[main.ts<br/>Bootstrap]
        AppModule[AppModule]
    end

    subgraph "Modules"
        AuthModule[AuthModule<br/>Guest login, JWT]
        RoomModule[RoomModule<br/>Room CRUD]
        RealtimeModule[RealtimeModule<br/>Socket.IO Gateway]
        GameLoopModule[GameLoopModule<br/>Tick-based timers]
        PrismaModule[PrismaModule<br/>DB client]
    end

    subgraph "External"
        DB[(PostgreSQL)]
    end

    Main --> AppModule
    AppModule --> AuthModule
    AppModule --> RoomModule
    AppModule --> RealtimeModule
    AppModule --> GameLoopModule
    AppModule --> PrismaModule
    AuthModule --> PrismaModule
    RealtimeModule --> RoomModule
    RealtimeModule --> GameLoopModule
    PrismaModule --> DB
```

### 3.2 Project Structure

```
apps/api/
├── src/
│   ├── main.ts                     # Bootstrap: NestFactory, IoAdapter, CORS, ValidationPipe
│   ├── app.module.ts               # Root module: imports all feature modules
│   ├── app.controller.ts           # Health check endpoint
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts      # POST /auth/guest, POST /auth/refresh
│   │   ├── auth.service.ts         # Guest user creation, JWT sign/verify
│   │   └── jwt.strategy.ts         # Passport JWT strategy
│   ├── room/
│   │   ├── room.module.ts
│   │   └── room.service.ts         # In-memory Map<roomCode, ServerRoom>
│   ├── realtime/
│   │   ├── realtime.module.ts
│   │   └── realtime.gateway.ts     # @WebSocketGateway — all Socket.IO event handlers
│   ├── game/
│   │   ├── game-loop.module.ts
│   │   └── game-loop.service.ts    # @Interval(1000) tick for timers and auto-transitions
│   └── prisma/
│       ├── prisma.module.ts
│       └── prisma.service.ts       # PrismaClient wrapper
├── prisma/
│   └── schema.prisma               # Database schema
├── nest-cli.json
├── tsconfig.json
└── package.json
```

### 3.3 Room & Game State (In-Memory)

Room and game state are held in `RoomService.rooms: Map<string, ServerRoom>`:

```typescript
interface ServerRoom {
  roomCode: string;          // 4-char code (e.g. "A3KP")
  hostId: string;            // User ID of the room creator
  status: "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
  maxPlayers: number;        // default 6
  players: RoomPlayer[];     // lobby view of each player
  gameState: GameState | null; // populated when game starts
  createdAt: Date;
}
```

A secondary index `userToRoom: Map<userId, roomCode>` enables O(1) lookup of a user's current room.

### 3.4 Game Engine (Pure Functions)

All game logic lives in `packages/game-logic/src/engine.ts` as pure functions that take a `GameState` and return a new `GameState`. No side effects, no I/O.

| Function | Input | Output | Purpose |
|---|---|---|---|
| `createDeck()` | — | `GameCard[]` (30 cards) | 3 suits × 10 numbers, shuffled |
| `createInitialState(roomCode)` | room code | `GameState` (LOBBY phase) | Empty state for a new room |
| `startGame(state)` | LOBBY state | PLAYER_TURN state | Deal 5 cards each, pick random first player |
| `playCard(state, playerId, cardId, declaration)` | PLAYER_TURN state | CHALLENGE_PHASE state or `null` | Validate player and card, move to challenge |
| `resolveChallenge(state, challengerId)` | CHALLENGE_PHASE state | REVEAL state | Compare actual vs declared, produce `ChallengeResult` |
| `applyPenalty(state)` | REVEAL state | PENALTY state | Loser draws 2, winner scores +1 |
| `acceptDeclaration(state)` | CHALLENGE_PHASE state | NEXT_TURN state | No challenge — player scores +1 |
| `nextTurn(state)` | PENALTY / NEXT_TURN state | PLAYER_TURN or END_GAME | Advance index, check win condition |

### 3.5 Game Phase State Machine

```mermaid
stateDiagram-v2
    [*] --> LOBBY
    LOBBY --> PLAYER_TURN : host starts game<br/>(startGame)

    PLAYER_TURN --> CHALLENGE_PHASE : player plays card<br/>(playCard)

    CHALLENGE_PHASE --> REVEAL : someone challenges<br/>(resolveChallenge)
    CHALLENGE_PHASE --> NEXT_TURN : timer expires / accept<br/>(acceptDeclaration)

    REVEAL --> PENALTY : timer expires<br/>(applyPenalty)

    PENALTY --> PLAYER_TURN : timer expires, cards remain<br/>(nextTurn)
    PENALTY --> END_GAME : hand empty or deck empty<br/>(nextTurn → endGame)

    NEXT_TURN --> PLAYER_TURN : timer expires, cards remain<br/>(nextTurn)
    NEXT_TURN --> END_GAME : hand empty or deck empty<br/>(nextTurn → endGame)

    END_GAME --> [*]
```

### 3.6 Game Loop Service

`GameLoopService` runs a `@Interval(1000)` tick that iterates all active rooms and manages automatic phase transitions:

| Current Phase | Timer | On Expire |
|---|---|---|
| `CHALLENGE_PHASE` | 5 → 0 | `acceptDeclaration()` — no one challenged |
| `REVEAL` | 2 → 0 | `applyPenalty()` — show result, then apply |
| `PENALTY` | 2 → 0 | `nextTurn()` — advance to next player |
| `NEXT_TURN` | 2 → 0 | `nextTurn()` — advance to next player |

After each tick mutation, the service broadcasts `game:state-update` to the room.

### 3.7 Socket.IO Gateway (RealtimeGateway)

The gateway is the central event router. It handles Socket.IO authentication via middleware (`jwt.verify` on `handshake.auth.token`), then dispatches events to `RoomService` and game-logic functions.

| Event | Handler | Side Effects |
|---|---|---|
| `room:create` | `handleCreate` | Creates room, joins Socket.IO room, emits `room:joined` |
| `room:join` | `handleJoin` | Validates room, adds player, emits `room:joined` + `room:player-joined` |
| `room:leave` | `handleLeave` | Removes player, emits `room:player-left`, reassigns host if needed |
| `room:ready` | `handleReady` | Toggles ready flag, broadcasts `room:player-ready` |
| `room:start` | `handleStart` | Validates all ready + min 2, starts game, emits `room:game-start` |
| `game:play-card` | `handlePlayCard` | Runs `playCard()`, broadcasts `game:state-update` |
| `game:challenge` | `handleChallenge` | Runs `resolveChallenge()`, broadcasts update + `game:challenge-result` |
| `game:accept` | `handleAccept` | Runs `acceptDeclaration()`, broadcasts `game:state-update` |
| `chat:send` | `handleChat` | Truncates to 200 chars, broadcasts `chat:message` |
| `webrtc:*` | `handleWebrtc*` | Relay signaling messages between peers |

---

## 4. Real-Time Communication

### 4.1 Socket Events Specification

#### Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `room:create` | `{ maxPlayers?: number, isPrivate?: boolean }` | Create a new room |
| `room:join` | `roomCode: string` | Join an existing room |
| `room:leave` | — | Leave current room |
| `room:ready` | `ready: boolean` | Toggle ready status |
| `room:start` | — | Host starts the game |
| `game:play-card` | `{ cardId: string, declaration: Declaration }` | Play a card face-down |
| `game:challenge` | — | Challenge current player |
| `game:accept` | — | Accept declaration (no challenge) |
| `chat:send` | `content: string` | Send chat message |
| `webrtc:join-room` | `roomCode?: string` | Announce WebRTC presence |
| `webrtc:leave-room` | — | Leave WebRTC session |
| `webrtc:offer` | `{ peerId, offer }` | Send SDP offer |
| `webrtc:answer` | `{ peerId, answer }` | Send SDP answer |
| `webrtc:ice-candidate` | `{ peerId, candidate }` | Send ICE candidate |

#### Server → Client Events

| Event | Payload | Description |
|---|---|---|
| `room:joined` | `RoomState` | You successfully joined a room |
| `room:player-joined` | `RoomPlayer` | Another player joined |
| `room:player-left` | `{ playerId }` | A player left |
| `room:player-ready` | `{ playerId, ready }` | Ready status changed |
| `room:host-changed` | `{ newHostId }` | Host reassigned |
| `room:game-start` | `GameState` | Game has started |
| `game:state-update` | `GameState` | Game state changed (any phase) |
| `game:challenge-result` | `ChallengeResult` | Challenge resolved |
| `game:winner` | `{ winner: GamePlayer, scores: Score[] }` | Game ended |
| `chat:message` | `ChatMessage` | New chat message |
| `webrtc:peer-joined` | `{ peerId }` | A peer is ready for WebRTC |
| `webrtc:peer-left` | `{ peerId }` | A peer left WebRTC |
| `webrtc:offer` | `{ peerId, offer }` | Incoming SDP offer |
| `webrtc:answer` | `{ peerId, answer }` | Incoming SDP answer |
| `webrtc:ice-candidate` | `{ peerId, candidate }` | Incoming ICE candidate |
| `error` | `{ code, message }` | Error occurred |

### 4.2 Room Lifecycle

```mermaid
sequenceDiagram
    participant P1 as Player 1 (Host)
    participant P2 as Player 2
    participant Server

    P1->>Server: room:create { maxPlayers: 4 }
    Server-->>P1: room:joined { roomCode: "A3KP", ... }

    P2->>Server: room:join "A3KP"
    Server-->>P2: room:joined { roomCode: "A3KP", players: [...] }
    Server-->>P1: room:player-joined { id, nickname, ... }

    P1->>Server: room:ready true
    Server-->>P1: room:player-ready { playerId: P1, ready: true }
    Server-->>P2: room:player-ready { playerId: P1, ready: true }

    P2->>Server: room:ready true
    Server-->>P1: room:player-ready { playerId: P2, ready: true }
    Server-->>P2: room:player-ready { playerId: P2, ready: true }

    P1->>Server: room:start
    Server-->>P1: room:game-start { phase: PLAYER_TURN, ... }
    Server-->>P2: room:game-start { phase: PLAYER_TURN, ... }
```

### 4.3 Game Turn Flow

```mermaid
sequenceDiagram
    participant P1 as Player 1 (current turn)
    participant P2 as Player 2
    participant Server
    participant Loop as GameLoopService

    Note over P1, Server: Phase: PLAYER_TURN

    P1->>Server: game:play-card { cardId, declaration: { type: "chili", number: 7 } }
    Server->>Server: playCard() validates & transitions to CHALLENGE_PHASE
    Server-->>P1: game:state-update { phase: CHALLENGE_PHASE, challengeTimer: 5 }
    Server-->>P2: game:state-update { phase: CHALLENGE_PHASE, challengeTimer: 5 }

    Note over P2: 5-second challenge window

    alt Player 2 challenges
        P2->>Server: game:challenge
        Server->>Server: resolveChallenge() → REVEAL
        Server-->>P1: game:state-update { phase: REVEAL }
        Server-->>P2: game:state-update { phase: REVEAL }
        Server-->>P1: game:challenge-result { wasBluff, ... }
        Server-->>P2: game:challenge-result { wasBluff, ... }
        Loop->>Server: tick → applyPenalty() → PENALTY
        Server-->>P1: game:state-update { phase: PENALTY }
        Server-->>P2: game:state-update { phase: PENALTY }
        Loop->>Server: tick → nextTurn() → PLAYER_TURN
    else No challenge (timer expires)
        Loop->>Server: tick → challengeTimer 0 → acceptDeclaration()
        Server-->>P1: game:state-update { phase: NEXT_TURN }
        Server-->>P2: game:state-update { phase: NEXT_TURN }
        Loop->>Server: tick → nextTurn() → PLAYER_TURN
    end
```

---

## 5. Database Design

### 5.1 Current Schema (V1 / MVP)

The MVP persists only user identity. Room and game state live in server memory.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  nickname  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 5.2 Planned Schema (V2 — Game History & Stats)

To support PRD requirements FR-014 (User Profile/Stats), FR-007 (Game History), and NFR-007 (Data Retention), the schema will expand to:

```prisma
model User {
  id          String        @id @default(uuid())
  nickname    String
  email       String?       @unique
  avatarUrl   String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  lastLoginAt DateTime?

  gamePlayers GamePlayer[]
  stats       UserStats?

  @@map("users")
}

model GameSession {
  id         String        @id @default(uuid())
  roomCode   String
  status     SessionStatus @default(WAITING)
  maxPlayers Int           @default(6)
  createdAt  DateTime      @default(now())
  endedAt    DateTime?

  players    GamePlayer[]
  messages   ChatMessage[]

  @@index([status])
  @@map("game_sessions")
}

model GamePlayer {
  id        String      @id @default(uuid())
  userId    String
  sessionId String
  nickname  String
  score     Int         @default(0)
  position  Int
  isHost    Boolean     @default(false)
  joinedAt  DateTime    @default(now())

  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  session   GameSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([userId, sessionId])
  @@index([sessionId])
  @@map("game_players")
}

model ChatMessage {
  id        String      @id @default(uuid())
  sessionId String
  userId    String
  content   String
  type      MessageType @default(TEXT)
  createdAt DateTime    @default(now())

  session   GameSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@map("chat_messages")
}

model UserStats {
  id            String   @id @default(uuid())
  userId        String   @unique
  gamesPlayed   Int      @default(0)
  gamesWon      Int      @default(0)
  totalScore    Int      @default(0)
  highestStreak Int      @default(0)
  updatedAt     DateTime @updatedAt

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_stats")
}

enum SessionStatus {
  WAITING
  IN_PROGRESS
  FINISHED
  CANCELLED
}

enum MessageType {
  TEXT
  SYSTEM
  EMOJI
}
```

**Migration path**: The V2 schema adds tables alongside the existing `User` model. At game end, the server writes a `GameSession` row with final scores. This is additive — no existing data is modified.

---

## 6. WebRTC Design

### 6.1 Architecture

WebRTC is used for peer-to-peer video/voice between players in a room. The server (Socket.IO) acts only as a signaling relay — it forwards SDP offers/answers and ICE candidates between peers. Media never touches the server.

```mermaid
graph TB
    subgraph "Signaling (Socket.IO)"
        GW[RealtimeGateway]
    end

    subgraph "ICE Servers"
        STUN["stun:stun.l.google.com:19302<br/>stun:stun1.l.google.com:19302<br/>stun:stun2.l.google.com:19302"]
        TURN["Coturn (future)"]
    end

    P1[Player 1] <-->|offer/answer/ICE| GW
    P2[Player 2] <-->|offer/answer/ICE| GW

    P1 <-.->|media stream| P2

    P1 -->|NAT traversal| STUN
    P2 -->|NAT traversal| STUN
    P1 -.->|fallback| TURN
    P2 -.->|fallback| TURN
```

### 6.2 Connection Flow

```mermaid
sequenceDiagram
    participant P1 as Player 1
    participant Server as Socket.IO
    participant P2 as Player 2

    P1->>P1: getUserMedia()
    P1->>Server: webrtc:join-room
    Server-->>P2: webrtc:peer-joined { peerId: P1 }

    P2->>P2: createPeerConnection(P1)
    P2->>P2: createOffer()
    P2->>Server: webrtc:offer { peerId: P1, offer }
    Server-->>P1: webrtc:offer { peerId: P2, offer }

    P1->>P1: setRemoteDescription(offer)
    P1->>P1: createAnswer()
    P1->>Server: webrtc:answer { peerId: P2, answer }
    Server-->>P2: webrtc:answer { peerId: P1, answer }

    Note over P1, P2: ICE candidate exchange
    P1->>Server: webrtc:ice-candidate { peerId: P2, candidate }
    Server-->>P2: webrtc:ice-candidate { peerId: P1, candidate }

    Note over P1, P2: Peer-to-peer media connected
```

### 6.3 Client Hook (`useWebRTC`)

The `useWebRTC(roomCode)` hook manages:

- Local media stream via `getUserMedia` (720p video, echo-cancelled audio)
- A `Map<peerId, RTCPeerConnection>` for all peers
- ICE candidate exchange through Socket.IO signaling events
- Auto-cleanup on peer disconnect or component unmount
- Toggle controls for audio and video tracks

### 6.4 TURN Server (Future)

For V1, only public Google STUN servers are configured. This works for most networks but fails behind symmetric NAT. When video/voice becomes a priority ("Should Have" in PRD §7), a self-hosted Coturn TURN server will be added:

```yaml
# docker-compose.yml addition
coturn:
  image: coturn/coturn:latest
  network_mode: host
  volumes:
    - ./coturn/turnserver.conf:/etc/coturn/turnserver.conf
```

---

## 7. Security Design

### 7.1 Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Client as Next.js Client
    participant API as NestJS API
    participant DB as PostgreSQL

    User->>Client: Enter nickname
    Client->>API: POST /auth/guest { nickname }
    API->>DB: INSERT User { nickname }
    API->>API: Sign JWT (sub: userId, nickname)
    API-->>Client: { user, accessToken (15m), refreshToken (7d) }
    Client->>Client: Persist to localStorage (zustand/persist)

    Client->>API: Socket.IO connect { auth: { token } }
    API->>API: Verify JWT in gateway middleware
    API-->>Client: Connection established
```

### 7.2 JWT Structure

```typescript
// Access token — 15 minutes
interface AccessPayload {
  sub: string;       // User ID
  nickname: string;
  iat: number;
  exp: number;
}

// Refresh token — 7 days
interface RefreshPayload {
  sub: string;
  typ: "refresh";
  iat: number;
  exp: number;
}
```

### 7.3 Security Measures

| Layer | Measure | Implementation |
|---|---|---|
| **Transport** | HTTPS/WSS | Enforced at reverse proxy level (future) |
| **Authentication** | JWT access + refresh | 15-min access, 7-day refresh, Passport strategy |
| **Socket auth** | Gateway middleware | `jwt.verify()` on `handshake.auth.token` |
| **Input validation** | NestJS `ValidationPipe` + `class-validator` | All REST DTOs whitelisted and validated |
| **Chat sanitization** | Server-side truncation | Messages capped at 200 characters |
| **Game integrity** | Server-authoritative logic | Clients cannot forge moves; `playCard()` validates turn and card ownership |
| **CORS** | Origin whitelist | `CLIENT_URL` env var controls allowed origin |
| **SQL injection** | Prisma ORM | Parameterized queries only |
| **XSS** | React auto-escaping | No `dangerouslySetInnerHTML` usage |
| **Room access** | Socket.IO rooms | Players can only emit to rooms they've joined |

### 7.4 Room Security

- **Room codes** use `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous characters like 0/O, 1/I/L).
- A player cannot join a room that is `IN_PROGRESS` or full.
- A player cannot challenge themselves.
- The host is automatically reassigned if the current host disconnects.

---

## 8. Infrastructure & Deployment

### 8.1 Development Setup

```yaml
# docker-compose.yml — development only
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: sweet_spicy
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

| Service | Port | How to run |
|---|---|---|
| PostgreSQL | `localhost:5433` | `docker compose up -d` |
| NestJS API | `localhost:3001` | `pnpm dev:api` |
| Next.js Web | `localhost:3000` | `pnpm dev:web` |

### 8.2 Environment Variables

**API (`apps/api/.env`)**

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:5433/sweet_spicy` | Prisma connection |
| `JWT_SECRET` | `sweet-spicy-dev-secret-change-me` | JWT signing key |
| `PORT` | `3001` | HTTP + Socket.IO port |
| `CLIENT_URL` | `http://localhost:3000` | CORS allowed origin |

**Web (`apps/web/.env.local`)**

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | REST API base URL |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:3001` | Socket.IO server URL |

### 8.3 Production Deployment Architecture (Future)

```mermaid
graph TB
    subgraph "Edge"
        CDN[CDN / Cloudflare<br/>Static assets + WAF]
    end

    subgraph "Load Balancer"
        LB[Nginx / ALB<br/>SSL termination<br/>Sticky sessions]
    end

    subgraph "Application"
        API1[NestJS Instance 1]
        API2[NestJS Instance 2]
    end

    subgraph "Data"
        Redis[Redis<br/>Socket.IO adapter<br/>Room state cache]
        PG[PostgreSQL<br/>User data + game history]
    end

    subgraph "Media"
        Coturn[Coturn TURN]
    end

    CDN --> LB
    LB -->|sticky sessions| API1 & API2
    API1 & API2 --> Redis
    API1 & API2 --> PG
```

### 8.4 Horizontal Scaling Plan

The current single-server architecture supports the MVP. To reach NFR-003 (500 concurrent rooms / 3000 players), the following changes are needed:

| Component | Current | Scaled |
|---|---|---|
| **Socket.IO** | Default in-memory adapter | `@socket.io/redis-adapter` — rooms sync across instances |
| **Room state** | `Map<string, ServerRoom>` in process memory | Redis hash per room (`room:{code}`) — shared across instances |
| **Game state** | Nested in `ServerRoom` | Redis hash (`game:{code}`) — read/write by any instance |
| **Load balancer** | N/A | Sticky sessions by Socket.IO `sid` cookie |
| **PostgreSQL** | Single instance | Primary + read replica |
| **Static assets** | Served by Next.js | CDN (Cloudflare / CloudFront) |
| **TURN** | None | Coturn with multiple relay IPs |

**Migration sequence**: Redis adapter first (enables multi-instance Sockets), then room state migration (move `Map` to Redis), then game state migration. Each step is independently deployable.

---

## 9. API Reference

### 9.1 REST Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/guest` | None | Create guest user, get JWT tokens |
| `POST` | `/auth/refresh` | None | Exchange refresh token for new access token |

All other game interactions happen over Socket.IO events (see §4.1).

### 9.2 Request/Response Examples

#### Create Guest Account

```http
POST /auth/guest
Content-Type: application/json

{
  "nickname": "Player123"
}
```

```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "nickname": "Player123" },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  }
}
```

#### Refresh Access Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbG..."
}
```

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG..."
  }
}
```

---

## 10. Error Handling

### 10.1 Error Codes

| Code | Context | Description |
|---|---|---|
| `Unauthorized` | Socket handshake | Missing or invalid JWT |
| `ROOM_NOT_FOUND` | `room:join` | Room code doesn't exist |
| `ROOM_FULL` | `room:join` | Room at max capacity |
| `GAME_IN_PROGRESS` | `room:join` | Game already started |
| `START_FAILED` | `room:start` | Not host, < 2 players, or not all ready |
| `INVALID_MOVE` | `game:play-card` | Not your turn, or card not in hand |
| `CANNOT_CHALLENGE_SELF` | `game:challenge` | Player tried to challenge their own card |
| `SERVER_ERROR` | Any | Unhandled internal error |

### 10.2 Error Response Format

Socket errors are emitted via the `error` event:

```typescript
{ code: string; message: string }
```

REST errors use NestJS's built-in exception filters, returning standard HTTP status codes with a JSON body.

---

## 11. Monitoring & Observability

### 11.1 Metrics to Track (Future)

| Category | Metrics |
|---|---|
| **Business** | DAU, MAU, games started, games completed, avg game duration |
| **Performance** | Socket event latency (p50/p95), REST response time, WebRTC connection success rate |
| **Infrastructure** | CPU, memory, DB connections, active Socket.IO connections |
| **Errors** | Unhandled exceptions, Socket `error` event rate, failed JWT verifications |

### 11.2 Logging

The NestJS application uses the built-in `Logger`. Structured logging (e.g. Pino or Winston) should be added before production deployment, with fields for `roomCode`, `playerId`, and `action` on every game-related log entry.

---

## Appendix

### A. Game Rules Reference

- **Deck**: 30 cards — 3 suits (Chili, Pepper, Lemon) × 10 numbers (1–10)
- **Deal**: 5 cards per player at game start
- **Play**: On your turn, play a card face-down and declare its suit and number (may bluff)
- **Challenge**: Other players have 5 seconds to challenge. If challenged:
  - **Bluff caught** → bluffer draws 2 penalty cards, challenger scores +1
  - **Truth challenged** → challenger draws 2 penalty cards, bluffer scores +1
- **Accept**: If no challenge within 5 seconds, the player scores +1
- **Win condition**: First player to empty their hand wins (+3 bonus). If draw pile runs out, game also ends. Final score = accumulated points + 3 (if empty hand) − remaining cards in hand
- **Tie**: All tied players share victory

### B. Technology Versions

| Package | Version |
|---|---|
| Node.js | 20.x LTS |
| pnpm | 10.x |
| Turborepo | 2.x |
| TypeScript | 5.x |
| Next.js | 16.x |
| React | 19.x |
| NestJS | 10.x |
| Socket.IO | 4.8 |
| PostgreSQL | 16 |
| Prisma | 5.x |
| Tailwind CSS | 3.x |
| Framer Motion | 12.x |
| Zustand | 5.x |
| i18next | 25.x |

### C. Monorepo Structure

```
spicy-sweet-game/
├── apps/
│   ├── web/                          # Next.js 16 frontend
│   │   ├── src/
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   └── api/                          # NestJS 10 backend
│       ├── src/
│       ├── prisma/
│       ├── nest-cli.json
│       └── package.json
├── packages/
│   ├── shared-types/                 # @sweet-spicy/shared-types
│   │   └── src/                      # game.ts, room.ts, chat.ts, auth.ts, socket-events.ts
│   └── game-logic/                   # @sweet-spicy/game-logic
│       └── src/                      # engine.ts — pure game functions
├── docs/
│   ├── prd/sweet-spicy-game/prd.md
│   └── technical-design/sweet-spicy-game/tdd.md
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### D. Shared Packages

**`@sweet-spicy/shared-types`** — TypeScript interfaces and enums shared between frontend and backend:

| File | Exports |
|---|---|
| `game.ts` | `SpiceType`, `GameCard`, `Declaration`, `GamePlayer`, `GamePhase`, `GameState`, `PlayedCard`, `ChallengeResult`, `SPICE_EMOJI`, `SPICE_LABEL` |
| `room.ts` | `RoomStatus`, `RoomPlayer`, `RoomState`, `JoinResult`, `CreateRoomData`, `CreateRoomResult`, `Score` |
| `socket-events.ts` | `ServerToClientEvents`, `ClientToServerEvents` |
| `chat.ts` | `ChatMessage` |
| `auth.ts` | `AuthUser`, `AuthResponse`, `SocketError` |

**`@sweet-spicy/game-logic`** — pure functions (see §3.4):

| Export | Purpose |
|---|---|
| `createDeck` | Generate and shuffle 30-card deck |
| `generateRoomCode` | 4-char alphanumeric (no ambiguous chars) |
| `createPlayer`, `createLobbyPlayer` | Factory functions for player objects |
| `createInitialState` | Empty LOBBY state |
| `addPlayerToGame`, `removePlayerFromGame` | Modify player list |
| `startGame` | Deal cards, pick first player |
| `playCard`, `playCardLocal` | Server and client-side card play |
| `resolveChallenge` | Compare actual vs declared card |
| `applyPenalty` | Penalty cards + score adjustment |
| `acceptDeclaration` | No challenge — score +1 |
| `nextTurn` | Advance turn or end game |

### E. PRD Traceability

| PRD Requirement | TDD Section | Status |
|---|---|---|
| FR-001: Create Room | §3.7 `room:create`, §4.2 | Implemented |
| FR-002: Join Room | §3.7 `room:join`, §4.2 | Implemented |
| FR-003: Player Readiness | §3.7 `room:ready` | Implemented |
| FR-004: Card Dealing | §3.4 `startGame()` | Implemented |
| FR-005: Play Card | §3.4 `playCard()`, §3.7 `game:play-card` | Implemented |
| FR-006: Challenge | §3.4 `resolveChallenge()`, §3.7 `game:challenge` | Implemented |
| FR-007: Accept Declaration | §3.4 `acceptDeclaration()`, §3.6 auto-accept | Implemented |
| FR-008: Turn Progression | §3.4 `nextTurn()`, §3.5 state machine | Implemented |
| FR-009: Scoring | §3.4 `applyPenalty()`, `endGame()` | Implemented |
| FR-010: Text Chat | §3.7 `chat:send` | Implemented |
| FR-011: Video Communication | §6 WebRTC Design | Hook implemented, no TURN |
| FR-012: Voice Communication | §6 WebRTC Design | Hook implemented, no TURN |
| FR-013: Guest Play | §7.1 Auth Flow | Implemented |
| FR-014: User Profile / Stats | §5.2 Planned Schema | Not yet implemented |
| FR-015: Room Settings | — | Not yet implemented |
| NFR-001: State Sync < 100ms | §4, Socket.IO | Architecture supports it |
| NFR-011: Auto-reconnect | §2.4 reconnection config | Implemented |

---

*Technical Design Document v2.0 — 2026-03-21*
*Status: Draft — aligned with implemented codebase*
