# Technical Design Document: Sweet & Spicy Online Card Game

> Technical Design Document for Sweet & Spicy Multiplayer Card Game
> Version: 1.0 | Date: 2026-03-18 | Status: Draft

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

---

## 1. Architecture Overview

### 1.1 System Context Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Web[Web Browser<br/>React SPA]
        Mobile[Mobile PWA]
    end
    
    subgraph "CDN & Load Balancer"
        CDN[Cloudflare CDN]
        LB[Nginx Load Balancer]
    end
    
    subgraph "Application Layer"
        API[API Server<br/>Node.js + Express]
        Socket[Socket.IO Server]
        Auth[Auth Service]
    end
    
    subgraph "Media Layer"
        STUN[STUN/TURN Server<br/>Coturn]
    end
    
    subgraph "Data Layer"
        Redis[Redis<br/>Session + Cache]
        DB[(PostgreSQL<br/>Game Data)]
    end
    
    Web --> CDN
    Mobile --> CDN
    CDN --> LB
    LB --> API
    LB --> Socket
    API --> Redis
    API --> DB
    Socket --> Redis
    Socket <--> STUN
```



### 1.2 Technology Stack


| Layer                | Technology               | Justification                                   |
| -------------------- | ------------------------ | ----------------------------------------------- |
| **Frontend**         | React 18 + TypeScript    | Component-based, type-safe, extensive ecosystem |
| **Build Tool**       | Vite                     | Fast dev server, optimized builds               |
| **UI Framework**     | shadcn/ui + Tailwind CSS | Modern, accessible, customizable                |
| **Animation**        | Framer Motion            | Smooth game animations                          |
| **State Management** | Zustand                  | Lightweight, simple API                         |
| **Real-Time**        | Socket.IO v4             | WebSocket fallback, rooms, acknowledgments      |
| **Video/Voice**      | WebRTC                   | Peer-to-peer, low latency                       |
| **Backend**          | Node.js + Express        | Event-driven, great Socket.IO support           |
| **Database**         | PostgreSQL + Prisma      | ACID, relational data                           |
| **Cache**            | Redis                    | Session, pub/sub, rate limiting                 |
| **STUN/TURN**        | Coturn                   | NAT traversal for WebRTC                        |


### 1.3 Architecture Principles

1. **Client-Server with Real-Time Sync**: Server is source of truth; client maintains local state
2. **Optimistic Updates**: Immediate UI feedback, reconcile with server
3. **Peer-to-Peer Media**: WebRTC for video/voice to reduce server load
4. **Stateless API**: Horizontal scaling, load balancer distributes requests
5. **Event-Driven**: Socket.IO for game events, not polling

### 1.4 Key Design Decisions


| Decision                   | Choice                     | Rationale                   |
| -------------------------- | -------------------------- | --------------------------- |
| **Room-based multiplayer** | Socket.IO rooms            | Native support, scales well |
| **Server-authoritative**   | All game logic server-side | Prevents cheating           |
| **WebRTC for media**       | P2P with TURN fallback     | Cost-effective, low latency |
| **PostgreSQL**             | Relational DB              | Game state, user data ACID  |
| **Redis Pub/Sub**          | Cross-server communication | Multi-instance deployment   |
| **JWT Tokens**             | Authentication             | Stateless, widely supported |


---

## 2. Frontend Design

### 2.1 Project Structure

```
src/
├── components/
│   ├── ui/                    # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── game/                   # Game-specific components
│   │   ├── SpiceCard.tsx       # Card display
│   │   ├── PlayerHand.tsx      # Player's cards
│   │   ├── GameTable.tsx       # Main game area
│   │   ├── DeclareDialog.tsx   # Declaration modal
│   │   ├── ChallengePhase.tsx  # Challenge UI
│   │   ├── RevealResult.tsx    # Card reveal animation
│   │   ├── Scoreboard.tsx      # Score display
│   │   ├── OpponentBar.tsx     # Other players
│   │   └── VideoPanel.tsx      # Video streams
│   └── layout/
│       ├── Lobby.tsx           # Room lobby
│       ├── GameRoom.tsx        # Main game view
│       └── ChatPanel.tsx       # Chat component
├── lib/
│   ├── gameEngine.ts           # Pure game logic (shared)
│   ├── types.ts                # TypeScript interfaces
│   ├── utils.ts                # Utilities
│   └── socket.ts               # Socket.IO client
├── hooks/
│   ├── useGameSocket.ts        # Socket.IO hook
│   ├── useWebRTC.ts            # WebRTC hook
│   ├── useGameStore.ts         # Zustand store
│   └── useMediaDevices.ts      # Camera/mic access
├── pages/
│   ├── Index.tsx               # Home/Lobby
│   ├── Room.tsx                # Game room
│   └── NotFound.tsx
├── services/
│   ├── api.ts                  # REST API client
│   ├── auth.ts                 # Authentication
│   └── webrtc.ts               # WebRTC service
├── store/
│   ├── gameStore.ts            # Game state
│   ├── roomStore.ts            # Room state
│   └── userStore.ts            # User state
├── types/
│   ├── socket-events.ts        # Socket event types
│   └── api.ts                  # API types
└── App.tsx                     # Root component
```

### 2.2 Component Architecture

#### Component Hierarchy

```mermaid
graph TD
    App --> Router
    Router --> Index[Home/Lobby]
    Router --> Room[Game Room]
    
    Index --> CreateRoom[Create Room]
    Index --> JoinRoom[Join Room]
    Index --> Nickname[Nickname Input]
    
    Room --> Header[Room Header]
    Room --> GameTable
    Room --> Sidebar
    Room --> Chat
    
    GameTable --> OpponentTop[Opponent Top]
    GameTable --> Center
    Center --> PlayedCard[Played Card]
    Center --> ActionBar[Action Bar]
    GameTable --> PlayerHand[Player Hand]
    
    Sidebar --> Scoreboard
    Sidebar --> PlayerList
    Sidebar --> VideoPanel
    
    Chat --> MessageList
    Chat --> Input
```



#### Key Components


| Component        | Responsibility          | Public API                                    |
| ---------------- | ----------------------- | --------------------------------------------- |
| `SpiceCard`      | Display single card     | `card`, `onClick`, `selected`, `hidden`       |
| `PlayerHand`     | Render all player cards | `cards`, `onCardSelect`, `playable`           |
| `GameTable`      | Main game area          | `gameState`, `currentPlayerId`                |
| `DeclareDialog`  | Card declaration        | `isOpen`, `onDeclare`, `selectedCard`         |
| `ChallengePhase` | Challenge UI            | `isActive`, `onChallenge`, `onAccept`         |
| `VideoPanel`     | Video streams           | `peers`, `localStream`, `onToggleAudio/Video` |
| `ChatPanel`      | Text chat               | `messages`, `onSend`, `unreadCount`           |


### 2.3 State Management

#### Zustand Store Structure

```typescript
// store/gameStore.ts
interface GameStore {
  // Game State
  gameState: GameState | null;
  setGameState: (state: GameState) => void;
  updateGameState: (partial: Partial<GameState>) => void;
  
  // Player State
  currentPlayerId: string | null;
  setCurrentPlayer: (id: string) => void;
  
  // UI State
  selectedCardId: string | null;
  setSelectedCard: (id: string | null) => void;
  
  // Actions
  playCard: (cardId: string, declaration: Declaration) => void;
  challenge: () => void;
  acceptDeclaration: () => void;
}

// store/roomStore.ts
interface RoomStore {
  roomCode: string | null;
  roomState: RoomState | null;
  players: Player[];
  isHost: boolean;
  isReady: boolean;
  
  // Actions
  joinRoom: (code: string) => Promise<void>;
  leaveRoom: () => void;
  setReady: (ready: boolean) => void;
  startGame: () => void;
}

// store/userStore.ts
interface UserStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // Actions
  login: (nickname: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string) => void;
}
```

#### State Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Store
    participant Socket
    participant Server
    
    User->>UI: Click card
    UI->>Store: setSelectedCard(cardId)
    Store-->>UI: State updated
    UI->>UI: Card highlighted
    
    User->>UI: Click Play
    UI->>Store: playCard(cardId, declaration)
    Store->>Socket: emit('game:play-card', { cardId, declaration })
    Socket->>Server: Send event
    Server->>Server: Validate & update state
    Server->>Socket: broadcast('game:state-update')
    Socket->>Store: updateGameState(newState)
    Store-->>UI: State updated
    UI->>UI: Animate card to center
```



### 2.4 Socket.IO Client Implementation

```typescript
// lib/socket.ts
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@/types/socket-events';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socketInstance: TypedSocket | null = null;

export function createSocket(token: string): TypedSocket {
  if (socketInstance) {
    socketInstance.disconnect();
  }
  
  socketInstance = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  });
  
  return socketInstance;
}

export function getSocket(): TypedSocket {
  if (!socketInstance) {
    throw new Error('Socket not initialized');
  }
  return socketInstance;
}
```

### 2.5 WebRTC Hook

```typescript
// hooks/useWebRTC.ts
import { useState, useEffect, useRef, useCallback } from 'react';

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWebRTC(roomId: string, userId: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  // Start local media stream
  const startLocalStream = useCallback(async (video = true, audio = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720 } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Failed to get media devices:', error);
      return null;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((peerId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate to peer via Socket.IO
        socket.emit('webrtc:ice-candidate', { peerId, candidate: event.candidate });
      }
    };
    
    pc.ontrack = (event) => {
      setPeers((prev) => {
        const newPeers = new Map(prev);
        const peer = newPeers.get(peerId) || { peerId, connection: pc };
        peer.stream = event.streams[0];
        newPeers.set(peerId, peer);
        return newPeers;
      });
    };
    
    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    
    peerConnections.current.set(peerId, pc);
    return pc;
  }, []);

  // Handle incoming offer
  const handleOffer = useCallback(async (peerId: string, offer: RTCSessionDescriptionInit) => {
    const pc = peerConnections.current.get(peerId) || createPeerConnection(peerId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('webrtc:answer', { peerId, answer });
  }, [createPeerConnection]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled((prev) => !prev);
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled((prev) => !prev);
    }
  }, []);

  // End call
  const endCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    setLocalStream(null);
    setPeers(new Map());
  }, []);

  return {
    localStream,
    peers: Array.from(peers.values()),
    isAudioEnabled,
    isVideoEnabled,
    startLocalStream,
    toggleAudio,
    toggleVideo,
    endCall,
    handleOffer,
  };
}
```

---

## 3. Backend Design

### 3.1 Server Architecture

```mermaid
graph TB
    subgraph "Node.js Server"
        Express[Express.js<br/>HTTP API]
        SocketIO[Socket.IO<br/>Game Events]
        GameManager[Game Manager<br/>Room & Game Logic]
        AuthMiddleware[Auth Middleware]
    end
    
    subgraph "Services"
        RoomService[Room Service]
        GameService[Game Service]
        UserService[User Service]
        Matchmaking[Matchmaking Service]
    end
    
    subgraph "Data"
        RedisPubSub[Redis Pub/Sub]
        Postgres[PostgreSQL]
    end
    
    Express --> AuthMiddleware
    SocketIO --> AuthMiddleware
    AuthMiddleware --> RoomService
    AuthMiddleware --> GameService
    RoomService --> GameManager
    GameService --> GameManager
    RoomService --> RedisPubSub
    GameService --> Postgres
    UserService --> Postgres
```



### 3.2 Project Structure (Backend)

```
server/
├── src/
│   ├── index.ts                # Entry point
│   ├── app.ts                  # Express app
│   ├── config/
│   │   ├── env.ts              # Environment variables
│   │   └── database.ts         # Prisma client
│   ├── middleware/
│   │   ├── auth.ts             # JWT verification
│   │   ├── rateLimiter.ts      # Rate limiting
│   │   └── validate.ts         # Request validation
│   ├── socket/
│   │   ├── index.ts            # Socket.IO setup
│   │   ├── events/
│   │   │   ├── room.ts         # Room events
│   │   │   ├── game.ts         # Game events
│   │   │   └── webrtc.ts       # WebRTC signaling
│   │   └── middleware/
│   │       └── auth.ts         # Socket auth
│   ├── services/
│   │   ├── room.service.ts     # Room management
│   │   ├── game.service.ts    # Game logic
│   │   ├── user.service.ts    # User management
│   │   └── match.service.ts   # Matchmaking
│   ├── utils/
│   │   ├── gameEngine.ts      # Pure game logic
│   │   └── roomCode.ts        # Room code generator
│   └── types/
│       └── socket.ts           # Socket types
├── prisma/
│   └── schema.prisma          # Database schema
├── package.json
└── tsconfig.json
```

### 3.3 Game Engine (Server-Side)

```typescript
// server/src/utils/gameEngine.ts
// This is the SERVER-SIDE authoritative game logic
// Client has a copy for optimistic updates only

import { GameCard, GameState, Player, Declaration, ChallengeResult, SpiceType } from './types';

export function createDeck(): GameCard[] {
  const types: SpiceType[] = ['chili', 'pepper', 'lemon'];
  const cards: GameCard[] = [];
  for (const type of types) {
    for (let num = 1; num <= 10; num++) {
      cards.push({ id: generateId(), type, number: num });
    }
  }
  return shuffleArray(cards);
}

export function startGame(players: Player[]): GameState {
  const deck = createDeck();
  const cardsPerPlayer = 5;
  
  const updatedPlayers = players.map((player) => ({
    ...player,
    hand: deck.splice(0, cardsPerPlayer),
    score: 0,
  }));
  
  const firstPlayer = Math.floor(Math.random() * players.length);
  
  return {
    phase: 'PLAYER_TURN',
    players: updatedPlayers,
    currentPlayerIndex: firstPlayer,
    drawPile: deck,
    playedCard: null,
    challengeResult: null,
    challengeTimer: 5,
    winner: null,
  };
}

export function playCard(
  state: GameState,
  playerId: string,
  cardId: string,
  declaration: Declaration
): GameState | null {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1 || state.currentPlayerIndex !== playerIndex) {
    return null; // Invalid player
  }
  
  const player = state.players[playerIndex];
  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    return null; // Card not in hand
  }
  
  const card = player.hand[cardIndex];
  const newHand = player.hand.filter((_, i) => i !== cardIndex);
  
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = { ...player, hand: newHand };
  
  return {
    ...state,
    phase: 'CHALLENGE_PHASE',
    players: updatedPlayers,
    playedCard: {
      card,
      declaration,
      playerId,
    },
  };
}

export function resolveChallenge(
  state: GameState,
  challengerId: string
): GameState {
  if (!state.playedCard) return state;
  
  const { card, declaration } = state.playedCard;
  const wasBluff = card.type !== declaration.type || card.number !== declaration.number;
  
  const result: ChallengeResult = {
    wasBluff,
    challengerId,
    playerId: state.playedCard.playerId,
    realCard: card,
    declaredCard: declaration,
  };
  
  return {
    ...state,
    phase: 'REVEAL',
    challengeResult: result,
  };
}

// ... more game logic functions
```

### 3.4 Socket.IO Event Handlers

```typescript
// server/src/socket/events/game.ts
import { Server, Socket } from 'socket.io';
import { gameService } from '../services/game.service';

export function registerGameHandlers(io: Server, socket: Socket) {
  
  // Player plays a card
  socket.on('game:play-card', async (data: { cardId: string; declaration: Declaration }) => {
    try {
      const result = gameService.playCard(
        socket.data.roomId,
        socket.data.playerId,
        data.cardId,
        data.declaration
      );
      
      if (result) {
        io.to(socket.data.roomId).emit('game:state-update', result);
      } else {
        socket.emit('error', { code: 'INVALID_MOVE', message: 'Cannot play this card' });
      }
    } catch (error) {
      socket.emit('error', { code: 'SERVER_ERROR', message: 'An error occurred' });
    }
  });
  
  // Player challenges
  socket.on('game:challenge', async () => {
    try {
      const result = gameService.resolveChallenge(
        socket.data.roomId,
        socket.data.playerId
      );
      
      io.to(socket.data.roomId).emit('game:state-update', result);
      io.to(socket.data.roomId).emit('game:challenge-result', result.challengeResult);
    } catch (error) {
      socket.emit('error', { code: 'SERVER_ERROR', message: 'An error occurred' });
    }
  });
  
  // Player accepts (no challenge)
  socket.on('game:accept', async () => {
    try {
      const result = gameService.acceptDeclaration(socket.data.roomId);
      io.to(socket.data.roomId).emit('game:state-update', result);
    } catch (error) {
      socket.emit('error', { code: 'SERVER_ERROR', message: 'An error occurred' });
    }
  });
}
```

---

## 4. Real-Time Communication

### 4.1 Socket Events Specification

#### Client → Server Events


| Event                  | Payload                                             | Description              |
| ---------------------- | --------------------------------------------------- | ------------------------ |
| `room:join`            | `{ roomCode: string }`                              | Join a room              |
| `room:leave`           | `{}`                                                | Leave current room       |
| `room:ready`           | `{ ready: boolean }`                                | Toggle ready status      |
| `game:play-card`       | `{ cardId: string, declaration: Declaration }`      | Play a card              |
| `game:challenge`       | `{}`                                                | Challenge current player |
| `game:accept`          | `{}`                                                | Accept declaration       |
| `chat:message`         | `{ content: string }`                               | Send chat message        |
| `webrtc:offer`         | `{ peerId: string, offer: RTCSessionDescription }`  | WebRTC offer             |
| `webrtc:answer`        | `{ peerId: string, answer: RTCSessionDescription }` | WebRTC answer            |
| `webrtc:ice-candidate` | `{ peerId: string, candidate: RTCIceCandidate }`    | ICE candidate            |


#### Server → Client Events


| Event                   | Payload                                | Description              |
| ----------------------- | -------------------------------------- | ------------------------ |
| `room:joined`           | `{ room: RoomState }`                  | Successfully joined room |
| `room:player-joined`    | `{ player: Player }`                   | New player joined        |
| `room:player-left`      | `{ playerId: string }`                 | Player left              |
| `room:player-ready`     | `{ playerId: string, ready: boolean }` | Player ready status      |
| `room:game-start`       | `{ gameState: GameState }`             | Game started             |
| `game:state-update`     | `{ gameState: GameState }`             | Game state changed       |
| `game:challenge-result` | `{ result: ChallengeResult }`          | Challenge resolved       |
| `game:winner`           | `{ winner: Player, scores: Score[] }`  | Game ended               |
| `chat:message`          | `{ message: ChatMessage }`             | New chat message         |
| `error`                 | `{ code: string, message: string }`    | Error occurred           |


### 4.2 Room Management Flow

```mermaid
sequenceDiagram
    participant Player1
    participant Player2
    participant Server
    
    Player1->>Server: room:create
    Server-->>Player1: room:created {roomCode: "ABCD"}
    
    Player1->>Server: room:share {roomCode: "ABCD"}
    
    Player2->>Server: room:join {roomCode: "ABCD"}
    Server-->>Player1: room:player-joined {player: Player2}
    Server-->>Player2: room:joined {room: RoomState}
    
    Player1->>Server: room:ready {ready: true}
    Server-->>Player2: room:player-ready {playerId: Player1, ready: true}
    
    Player2->>Server: room:ready {ready: true}
    Server-->>Player1: room:player-ready {playerId: Player2, ready: true}
    
    Server-->>Player1: room:game-start
    Server-->>Player2: room:game-start
```



### 4.3 Game State Flow

```mermaid
sequenceDiagram
    participant Player1
    participant Player2
    participant Server
    
    Note over Player1, Server: Phase: PLAYER_TURN
    
    Player1->>Server: game:play-card {cardId: "abc", declaration: {type: "chili", number: 7}}
    Server->>Server: Validate move
    
    Server-->>Player1: game:state-update {phase: CHALLENGE_PHASE}
    Server-->>Player2: game:state-update {phase: CHALLENGE_PHASE}
    
    Note over Player2: 5 second challenge window
    
    Player2->>Server: game:challenge
    Server->>Server: Resolve challenge
    
    Server-->>Player1: game:state-update {phase: REVEAL, result: {wasBluff: true}}
    Server-->>Player2: game:state-update {phase: REVEAL}
    
    Server-->>Player1: game:state-update {phase: PENALTY}
    Server-->>Player2: game:state-update {phase: NEXT_TURN}
```



---

## 5. Database Design

### 5.1 Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ GameSession : plays
    User ||--o{ GamePlayer : has
    GameSession ||--o{ GamePlayer : contains
    GameSession ||--o{ ChatMessage : has
    
    User {
        uuid id PK
        string nickname
        string email
        string avatar_url
        timestamptz created_at
        timestamptz last_login
    }
    
    GameSession {
        uuid id PK
        string room_code UK
        enum status
        int max_players
        timestamptz created_at
        timestamptz ended_at
    }
    
    GamePlayer {
        uuid id PK
        uuid user_id FK
        uuid session_id FK
        string nickname
        int score
        int position
        boolean is_host
        boolean is_ready
        timestamptz joined_at
    }
    
    ChatMessage {
        uuid id PK
        uuid session_id FK
        uuid player_id FK
        text content
        enum type
        timestamptz created_at
    }
    
    UserStats {
        uuid id PK
        uuid user_id FK
        int games_played
        int games_won
        int total_score
        int highest_streak
        timestamptz updated_at
    }
```



### 5.2 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String         @id @default(uuid())
  nickname      String         @unique
  email         String?        @unique
  avatarUrl     String?
  createdAt     DateTime       @default(now())
  lastLoginAt   DateTime?
  
  gamePlayers   GamePlayer[]
  chatMessages  ChatMessage[]
  stats         UserStats?
  
  @@map("users")
}

model GameSession {
  id          String         @id @default(uuid())
  roomCode    String         @unique
  status      SessionStatus @default(WAITING)
  maxPlayers  Int            @default(6)
  createdAt   DateTime       @default(now())
  endedAt     DateTime?
  
  players     GamePlayer[]
  chatMessages ChatMessage[]
  
  @@index([roomCode])
  @@index([status])
  @@map("game_sessions")
}

model GamePlayer {
  id          String      @id @default(uuid())
  userId      String
  sessionId   String
  nickname    String
  score       Int         @default(0)
  position    Int
  isHost      Boolean     @default(false)
  isReady     Boolean     @default(false)
  joinedAt    DateTime    @default(now())
  
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  session     GameSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  chatMessages ChatMessage[]
  
  @@unique([userId, sessionId])
  @@index([sessionId])
  @@map("game_players")
}

model ChatMessage {
  id          String      @id @default(uuid())
  sessionId   String
  playerId    String
  content     String
  type        MessageType @default(TEXT)
  createdAt   DateTime    @default(now())
  
  player      GamePlayer  @relation(fields: [playerId], references: [id], onDelete: Cascade)
  session     GameSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
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

### 5.3 Redis Schema

```typescript
// Redis keys structure

// Session data (expires in 24 hours)
const SESSION_PREFIX = 'session:';
const sessionKey = (token: string) => `${SESSION_PREFIX}${token}`;
// Value: JSON { userId, roomCode, expiresAt }

// Room state (expires in 1 hour)
const ROOM_PREFIX = 'room:';
const roomKey = (code: string) => `${ROOM_PREFIX}${code}`;
// Value: JSON { players: [...], settings: {...}, gameState: {...} }

// Game state (expires in 2 hours)
const GAME_PREFIX = 'game:';
const gameKey = (roomCode: string) => `${GAME_PREFIX}${roomCode}`;
// Value: JSON GameState

// User presence (expires in 30 seconds, heartbeat)
const PRESENCE_PREFIX = 'presence:';
const presenceKey = (roomCode: string) => `${PRESENCE_PREFIX}${roomCode}`;
// Value: Hash { playerId: lastHeartbeat }

// Rate limiting
const RATE_PREFIX = 'rate:';
const rateKey = (ip: string) => `${RATE_PREFIX}${ip}`;
// Value: { count: number, resetAt: timestamp }
```

---

## 6. WebRTC Design

### 6.1 Architecture

```mermaid
graph TB
    subgraph "Players"
        P1[Player 1]
        P2[Player 2]
        P3[Player 3]
    end
    
    subgraph "Signaling (Socket.IO)"
        Socket[Socket.IO Server]
    end
    
    subgraph "STUN/TURN"
        STUN[STUN Server<br/>stun:stun.l.google.com:19302]
        TURN[TURN Server<br/>Coturn]
    end
    
    P1 <--->|Offer/Answer/ICE| Socket
    P2 <--->|Offer/Answer/ICE| Socket
    P3 <--->|Offer/Answer/ICE| Socket
    
    P1 -->|NAT Traversal| STUN
    P2 -->|NAT Traversal| STUN
    P3 -->|NAT Traversal| STUN
    
    P1 -.->|Fallback| TURN
    P2 -.->|Fallback| TURN
    P3 -.->|Fallback| TURN
```



### 6.2 Connection Flow

```mermaid
sequenceDiagram
    participant P1 as Player 1
    participant P2 as Player 2
    participant Server as Socket.IO
    
    Note over P1: Enable video
    P1->>P1: getUserMedia()
    P1->>Server: webrtc:join-room {roomId}
    
    Note over P2: Enable video
    P2->>P2: getUserMedia()
    P2->>Server: webrtc:join-room {roomId}
    Server-->>P1: webrtc:peer-joined {peerId: P2}
    
    P1->>P1: createOffer()
    P1->>Server: webrtc:offer {peerId: P2, offer}
    Server-->>P2: webrtc:offer {peerId: P1, offer}
    
    P2->>P2: setRemoteDescription(offer)
    P2->>P2: createAnswer()
    P2->>Server: webrtc:answer {peerId: P1, answer}
    Server-->>P1: webrtc:answer {peerId: P2, answer}
    
    P1->>P1: setRemoteDescription(answer)
    P1->>P1: ICE candidate exchange
    P2->>P1: P2 video stream connected
```



### 6.3 ICE Candidate Handling

```typescript
// Server-side WebRTC handler
socket.on('webrtc:ice-candidate', async (data: { peerId: string; candidate: RTCIceCandidateInit }) => {
  // Find the target peer connection on server
  const targetSocket = await findSocketByPlayerId(data.peerId);
  
  if (targetSocket) {
    targetSocket.emit('webrtc:ice-candidate', {
      peerId: socket.data.playerId,
      candidate: data.candidate,
    });
  }
});
```

### 6.4 TURN Server Configuration

```yaml
# coturn turnserver.conf

listening-port=3478
tls-listening-port=5349
relay-ip=0.0.0.0
external-ip=YOUR_PUBLIC_IP
realm=yourdomain.com

user=username:password
total-quota=100
bps-capacity=0
stale-nonce=600

# STUN server
stun-server=stun.l.google.com:19302
```

---

## 7. Security Design

### 7.1 Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant Redis
    
    User->>Client: Enter nickname
    Client->>API: POST /auth/guest { nickname }
    
    API->>API: Validate nickname
    API->>Redis: Generate JWT (userId, roomId)
    API-->>Client: { token, user }
    
    Client->>Client: Store token
    
    Client->>Socket: Connect with token
    Socket->>Redis: Verify token
    Socket-->>Client: Socket connected
```



### 7.2 JWT Structure

```typescript
// Access Token (15 minutes)
interface AccessToken {
  userId: string;
  nickname: string;
  type: 'access';
  iat: number;
  exp: number;
}

// Refresh Token (7 days) - stored in httpOnly cookie
interface RefreshToken {
  userId: string;
  type: 'refresh';
  iat: number;
  exp: number;
}
```

### 7.3 Security Measures


| Layer                | Measure              | Implementation                            |
| -------------------- | -------------------- | ----------------------------------------- |
| **Transport**        | HTTPS/TLS            | All connections encrypted                 |
| **Authentication**   | JWT + Refresh Tokens | Short-lived access, long-lived refresh    |
| **Authorization**    | Room-based           | Players can only access their room        |
| **Rate Limiting**    | Redis                | 100 requests/min per IP                   |
| **Input Validation** | Zod                  | All API inputs validated                  |
| **SQL Injection**    | Prisma ORM           | Parameterized queries                     |
| **XSS**              | React                | Auto-escaping, no dangerouslySetInnerHTML |
| **CSRF**             | CORS                 | Proper origin validation                  |


### 7.4 Room Security

```typescript
// Middleware: verify room access
const verifyRoomAccess = async (socket: Socket, next: Function) => {
  const { roomId, playerId } = socket.data;
  
  // Verify player is in room
  const room = await redis.get(roomKey(roomId));
  if (!room) {
    return next(new Error('Room not found'));
  }
  
  const roomData = JSON.parse(room);
  if (!roomData.players.find(p => p.id === playerId)) {
    return next(new Error('Not authorized to access this room'));
  }
  
  next();
};
```

---

## 8. Infrastructure & Deployment

### 8.1 Deployment Architecture

```mermaid
graph TB
    subgraph "CDN & Edge"
        Cloudflare[Cloudflare<br/>WAF + DDoS]
    end
    
    subgraph "Load Balancer"
        Nginx[Nginx<br/>SSL Termination<br/>Load Balancing]
    end
    
    subgraph "Application Tier"
        API1[API Server 1]
        API2[API Server 2]
        Socket1[Socket Server 1]
        Socket2[Socket Server 2]
    end
    
    subgraph "Data Tier"
        Redis[Redis Cluster<br/>Cache + Pub/Sub]
        Postgres1[PostgreSQL Primary]
        Postgres2[PostgreSQL Replica]
    end
    
    subgraph "Media"
        Coturn[Coturn TURN Server]
    end
    
    Cloudflare --> Nginx
    Nginx --> API1 & API2
    Nginx --> Socket1 & Socket2
    API1 & API2 --> Redis
    API1 --> Postgres1
    Postgres1 --> Postgres2
    Socket1 & Socket2 --> Coturn
```



### 8.2 Docker Compose (Development)

```yaml
version: '3.8'

services:
  api:
    build: ./server
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/sweet_spicy
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-secret
    depends_on:
      - postgres
      - redis

  socket:
    build: ./server
    command: npm run socket
    ports:
      - "3002:3002"
    environment:
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-secret
    depends_on:
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=sweet_spicy
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  coturn:
    image: coturn/coturn:latest
    network_mode: host
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf

volumes:
  postgres_data:
```

### 8.3 Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Client
VITE_API_URL=https://api.yourdomain.com
VITE_SOCKET_URL=https://socket.yourdomain.com
VITE_STUN_SERVER=stun:stun.l.google.com:19302

# TURN Server
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_USERNAME=username
TURN_PASSWORD=password
```

### 8.4 Horizontal Scaling Strategy


| Component          | Scaling Strategy                                                        |
| ------------------ | ----------------------------------------------------------------------- |
| **API Servers**    | Stateless, add more instances behind load balancer                      |
| **Socket Servers** | Sticky sessions for rooms, Redis pub/sub for cross-server communication |
| **PostgreSQL**     | Read replicas for queries, primary for writes                           |
| **Redis**          | Cluster mode for high availability                                      |
| **TURN Server**    | Multiple instances, IP-based distribution                               |


---

## 9. API Reference

### 9.1 REST API Endpoints


| Method | Endpoint             | Description              |
| ------ | -------------------- | ------------------------ |
| POST   | `/auth/guest`        | Create guest account     |
| POST   | `/auth/refresh`      | Refresh access token     |
| GET    | `/user/me`           | Get current user profile |
| PATCH  | `/user/me`           | Update user profile      |
| GET    | `/user/:id/stats`    | Get user statistics      |
| POST   | `/rooms`             | Create new room          |
| GET    | `/rooms/:code`       | Get room details         |
| POST   | `/rooms/:code/join`  | Join a room              |
| DELETE | `/rooms/:code/leave` | Leave a room             |


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
    "user": {
      "id": "uuid",
      "nickname": "Player123",
      "avatarUrl": null
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Create Room

```http
POST /rooms
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "maxPlayers": 4,
  "isPrivate": false
}
```

```json
{
  "success": true,
  "data": {
    "roomCode": "ABCD",
    "hostId": "uuid",
    "maxPlayers": 4,
    "players": [
      {
        "id": "uuid",
        "nickname": "Player123",
        "isHost": true,
        "isReady": true
      }
    ],
    "status": "WAITING"
  }
}
```

---

## 10. Error Handling

### 10.1 Error Codes


| Code             | HTTP Status | Description                |
| ---------------- | ----------- | -------------------------- |
| `INVALID_INPUT`  | 400         | Invalid request parameters |
| `UNAUTHORIZED`   | 401         | Not authenticated          |
| `FORBIDDEN`      | 403         | Not authorized             |
| `NOT_FOUND`      | 404         | Resource not found         |
| `ROOM_FULL`      | 400         | Room is at max capacity    |
| `ROOM_NOT_FOUND` | 404         | Room doesn't exist         |
| `INVALID_MOVE`   | 400         | Game move not valid        |
| `NOT_YOUR_TURN`  | 400         | Not your turn to play      |
| `SERVER_ERROR`   | 500         | Internal server error      |
| `RATE_LIMITED`   | 429         | Too many requests          |


### 10.2 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "INVALID_MOVE",
    "message": "Cannot play this card - not in your hand",
    "details": {
      "reason": "CARD_NOT_IN_HAND",
      "cardId": "abc123"
    }
  }
}
```

---

## 11. Monitoring & Observability

### 11.1 Metrics to Track


| Category        | Metrics                                                                             |
| --------------- | ----------------------------------------------------------------------------------- |
| **Business**    | DAU, MAU, Games started, Games completed, Avg game duration                         |
| **Performance** | API latency (p50, p95, p99), Socket connection time, WebRTC connection success rate |
| **Technical**   | CPU, Memory, Database connections, Redis hit rate                                   |
| **Error**       | Error rate by type, Uncaught exceptions                                             |


### 11.2 Logging Structure

```typescript
// Structured logging with Winston/Pino
{
  "timestamp": "2026-03-18T12:00:00Z",
  "level": "info",
  "context": {
    "roomCode": "ABCD",
    "playerId": "uuid",
    "action": "game:play-card"
  },
  "message": "Player played a card",
  "metadata": {
    "cardId": "card-123",
    "declaration": { "type": "chili", "number": 7 }
  }
}
```

---

## 12. Appendix

### A. Game Rules Reference

- 30 cards: 3 suits × 10 numbers
- 5 cards dealt to each player at start
- Play must be higher number than previous card
- Can match or change suit
- Can bluff (declare different from actual card)
- Challenge: if bluff → bluffer draws 2, challenger scores +1
- Challenge: if truth → challenger draws 2, bluffer scores +1
- First to empty hand wins (+3 bonus), remaining cards subtract

### B. Technology Versions


| Package    | Version  |
| ---------- | -------- |
| Node.js    | 20.x LTS |
| React      | 18.3.x   |
| TypeScript | 5.x      |
| Vite       | 5.x      |
| Socket.IO  | 4.x      |
| PostgreSQL | 15.x     |
| Redis      | 7.x      |
| Prisma     | 5.x      |


### C. File Structure Summary

```
sweet-spicy-game/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   └── types/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── server/                    # Node.js backend
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── socket/
│   │   ├── services/
│   │   ├── utils/
│   │   └── index.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   └── tsconfig.json
│
├── docs/
│   ├── prd/
│   │   └── sweet-spicy-game/
│   │       └── prd.md
│   └── technical-design/
│       └── sweet-spicy-game/
│           └── tdd.md
│
└── docker-compose.yml
```

---

*Technical Design Document created: 2026-03-18*
*Status: Draft*
*Next step: Implementation Phase*