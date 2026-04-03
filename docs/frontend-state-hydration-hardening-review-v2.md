# Frontend State & Hydration Hardening Review v2

## Issue Table


| Route                  | Component / Area                | Warning Signature                        | Classification    | Root Cause                                                                                              | Repro Condition                            | Status                                            |
| ---------------------- | ------------------------------- | ---------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| `/`                    | `HomeClient`                    | hydration mismatch on first paint        | Real app issue    | Render-time reads from persisted `user`, `theme`, and language preference could diverge from SSR output | Persisted theme or user in browser storage | Fixed in this pass                                |
| `/room/[code]`         | `GameRoomClient`                | host badge / lobby mismatch on hydration | Real app issue    | Offline host identity was previously derived differently across server and client render paths          | Fresh room load before socket sync         | Fixed in prior pass                               |
| `/room/[code]`         | `ChatPanel` / `SidePanelSocial` | fallback message subtree mismatch risk   | Real app issue    | Demo system message embedded `new Date().toISOString()` in render path                                  | Empty chat on first render                 | Fixed in this pass                                |
| shared UI              | `SidebarMenuSkeleton`           | random skeleton width mismatch risk      | Real app issue    | `Math.random()` used in SSR-visible style value                                                         | Any SSR render including sidebar skeletons | Fixed in this pass                                |
| `/` and `/room/[code]` | browser DOM                     | `bis_skin_checked="1"`                   | External mutation | Browser extension injects attributes before React hydrates                                              | Extension-enabled profile only             | Not an app bug unless reproduced in clean profile |


## State Ownership Map


| State Bucket                    | Owner                    | Source of Truth                                             | Notes                                                                 |
| ------------------------------- | ------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| Auth identity and tokens        | `userStore`              | client persisted state plus auth API                        | Visible UI must wait for store hydration if data is not server-seeded |
| Socket session lifecycle        | `useGameSocket`          | server auth + socket transport                              | Centralized connection, reconnect, unauthorized, and reset handling   |
| Room membership and lobby state | `roomStore`              | server realtime payloads                                    | Cache only, should never outrank socket or server room state          |
| Projected game state            | `gameStore`              | server realtime payloads                                    | Online mode is authoritative from socket updates                      |
| Chat history                    | `chatStore`              | socket events                                               | Cache only; fallback messages must stay deterministic                 |
| Theme / language / SFX          | browser preference layer | `next-themes`, i18n cookie/local storage, local SFX storage | Must not change SSR-visible markup before hydration                   |
| Local page UI state             | route component state    | component-local                                             | Dialogs, drag state, active tabs, form drafts, visual-only flags      |


## Route Transition Matrix


| Transition                           | Persist                                          | Reset                         | Notes                                                                  |
| ------------------------------------ | ------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------- |
| `/` initial load                     | none required for SSR shell                      | n/a                           | Preference controls should render in hydration-safe mode until mounted |
| `/` -> `/room/new`                   | hydrated auth state after guest login            | homepage form-only state      | Room creation should begin only after socket/session is ready          |
| `/` -> `/room/[code]`                | hydrated auth state after guest login            | homepage form-only state      | Join uses route code plus socket ack                                   |
| `/room/new` -> `/room/[code]`        | socket session, room cache                       | local create-loading state    | Route replacement after successful create ack                          |
| `/room/[code]` reconnect             | room/game/chat caches                            | transport-only state          | Resume should reconcile from socket, not route refs                    |
| `/room/[code]` explicit leave -> `/` | none of `room/game/chat`                         | room, game, chat caches       | Auth may remain if session is still valid                              |
| logout anywhere                      | nothing except browser-only theme/language prefs | user, room, game, chat caches | Unrecoverable auth failure should converge to this path                |


## Reset Policy Matrix


| Event                          | User               | Room    | Game    | Chat  | Notes                                                |
| ------------------------------ | ------------------ | ------- | ------- | ----- | ---------------------------------------------------- |
| Successful explicit leave      | keep               | reset   | reset   | reset | Current socket hook already follows this shape       |
| Resume failure after reconnect | keep if auth valid | reset   | reset   | reset | UI should abandon stale room state                   |
| Unrecoverable auth failure     | reset              | reset   | reset   | reset | Hard reset to homepage flow                          |
| Transient disconnect           | keep               | keep    | keep    | keep  | Do not clear optimistic caches before resume outcome |
| Room switch                    | keep               | replace | replace | reset | Old room cache must not leak into new room           |


## Realtime Boundary Findings

1. `useGameSocket` is the correct owner for socket lifecycle and cache resets. Keep reconnect, unauthorized handling, and leave semantics centralized there.
2. `GameRoomClient` still mixes local offline state and online-authoritative state. This is acceptable for incremental hardening, but it remains the main maintainability pressure point in the web app.
3. Route refs such as one-shot create/join guards are acceptable for transport dedupe, but they must not be treated as room membership truth.
4. Store consumers should keep selectors narrow. UI components should derive booleans and display data locally instead of subscribing to broad store objects when possible.

## Implemented In This Pass

1. Added a shared `useHydrated()` hook for mount-aware rendering.
2. Added explicit `hasHydrated` tracking to `userStore` so persisted auth state can be consumed safely.
3. Hardened `/` so theme and language controls no longer depend on browser-only preference values during the hydration frame.
4. Replaced render-time timestamp and random placeholder values with deterministic values in chat/social fallback UI and sidebar skeletons.
5. Made the smooth countdown hook deterministic on first render by removing `Date.now()` from initial state setup.

## Follow-up Backlog

1. Narrow `useUserStore`, `useRoomStore`, and `useGameStore` subscriptions in route components and large panels.
2. Extract a room session coordinator from `GameRoomClient` if online/offline branching grows further.
3. Audit all SSR-visible components for browser preference reads before adding more persisted client state.
4. Add a clean-browser manual verification checklist to regular QA so extension noise is separated from real regressions early.

