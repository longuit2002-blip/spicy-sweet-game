# Đặc tả prototype UI/UX — Sweet & Spicy

Tài liệu này mô tả **hành vi prototype** (clickable spec): trạng thái, disabled rules, feedback, và **ánh xạ tới component** trong repo. Dùng để dựng Figma prototype hoặc kiểm thử UX không cần đọc hết code.

---

## 1. Persona & mục tiêu trải nghiệm

| Persona | Mục tiêu UI |
|---------|-------------|
| Người chơi casual (mobile) | Vào phòng nhanh, đọc được timer thách, bấm claim/accept dễ |
| Host | Thấy rõ ai ready, chỉ host start (online) |
| Người quan sát / reconnect | Phase pill + online/offline trong header |

**Cảm giác sản phẩm**: “bàn spice ấm, tập trung vào lá và thách”, không clutter chat/video lên vùng timer.

---

## 2. Design tokens (bắt buộc đồng bộ)

Nguồn: `apps/web/src/app/globals.css` + Tailwind `theme`.

| Nhóm | Token / biến | Dùng cho |
|------|--------------|----------|
| Nền app | `--background`, `--gradient-dark` | Shell phòng, landing |
| Bàn | `--surface-felt`, `.game-table-surface` | GameTable felt |
| Gia vị | `--chili`, `--pepper`, `--wasabi` | SpiceCard, declare chips |
| CTA | `--primary`, `bg-gradient-fire` | Start, Play, Ready |
| Trophy | `--trophy-gold`, amber utilities | Trophy UI |
| Typography | `--font-display` (Dela Gothic One), `--font-body` (Inter) | Title vs body |

Prototype Figma: tạo **color styles** trùng tên semantic (không hardcode hex lẻ nếu có thể lấy từ dev).

---

## 3. Map màn hình → component / file

| Vùng UI | Component chính | Đường dẫn |
|---------|-----------------|-----------|
| Landing | `HomeClient` | `apps/web/src/app/home-client.tsx` |
| Shell phòng | `GameRoomClient` | `apps/web/src/app/room/[code]/game-room-client.tsx` |
| Bàn | `GameTable` | `apps/web/src/features/game/components/GameTable/GameTable.tsx` |
| Thách trên bàn | `ChallengePhase` | `apps/web/src/features/game/components/ChallengePhase/ChallengePhase.tsx` |
| Tay bài | `PlayerHand` | `apps/web/src/features/game/components/PlayerHand/PlayerHand.tsx` |
| Ghế local | `PlayerSeat` | `apps/web/src/features/game/components/PlayerSeat/PlayerSeat.tsx` |
| Đối thủ | `OpponentBar` + seats | `.../OpponentBar/OpponentBar.tsx` |
| Tuyên bố | `DeclareDialog` | `.../DeclareDialog/DeclareDialog.tsx` |
| Lộ bài | `RevealResult` | `.../RevealResult/RevealResult.tsx` |
| Điểm | `Scoreboard` | `.../Scoreboard/Scoreboard.tsx` |
| Nhật ký | `ActionLog` | `.../ActionLog/ActionLog.tsx` |
| Chat | `ChatPanel` | `apps/web/src/features/chat/components/ChatPanel/` |
| Video | `VideoPanel` | `apps/web/src/features/video/components/VideoPanel/VideoPanel.tsx` |

---

## 4. Prototype — luồng H1 Landing

| Bước | Hành động user | Phản hồi UI | Ghi chú |
|------|----------------|-------------|---------|
| L1 | Mở `/` | Hiện form | SSR shell + client hydrate |
| L2 | Nhập nickname rỗng + Create | Không gọi API | Nút disabled hoặc no-op theo code hiện tại |
| L3 | Create thành công | Navigate `/room/new` → replace mã thật | Loading state trên nút |
| L4 | Join với mã | Navigate `/room/CODE` | Uppercase trim |

**Figma**: frame H1 với 2 trạng thái `default` / `error` / `loading`.

---

## 5. Prototype — R0 Lobby

| Element | Trạng thái | Hành vi |
|---------|------------|---------|
| Ready | `isReady` | Viền xanh / muted |
| Start | disabled nếu <2 người, chưa all ready, hoặc online & không phải host | Tooltip `hostStartsOnly` |
| Add bot | disabled khi online hoặc đủ 6 người | — |
| Avatar stack header | highlight `currentPlayer` | Vòng primary |

**Live region**: phase pill có `aria-live="polite"` trên badge phase.

---

## 6. Prototype — R1 PLAYER_TURN

| Element | Enabled khi | Feedback |
|---------|--------------|----------|
| `PlayerHand` | `isMyTurn && phase === PLAYER_TURN` | Disabled opacity khi không tới lượt |
| Tap lá | trên điều kiện trên | Mở `DeclareDialog` |
| Phase strip | luôn | “Your turn” / “Waiting for {name}” |

**Gesture**: mobile — hand scroll ngang; đủ touch target cho mỗi lá.

---

## 7. Prototype — R2 CHALLENGE_PHASE (hai bước)

### 7.1 CLAIM_RACE (`challengeStep === CLAIM_RACE`)

| Control | Ai dùng | Kết quả |
|---------|---------|---------|
| Claim | Mọi người trừ declarer | Emit `claimChallenge`; server chọn first wins |
| Accept | Mọi người | Emit `acceptDeclaration` — skip challenge |

Timer: `challengeTimer` đếm từ `CHALLENGE_CLAIM_RACE_SECONDS` về 0 (tick 1s).

**Prototype rule**: hiển thị **cùng một thanh timer** cho cả race; khi hết giờ → auto chuyển nhánh accept (không cần hotspot Accept nếu auto).

### 7.2 PICK_TYPE

| Control | Ai dùng | Kết quả |
|---------|---------|---------|
| Challenge suit | Chỉ `challengeClaimHolderId` | `resolveChallenge(..., "suit")` |
| Challenge number | Chỉ holder | `resolveChallenge(..., "number")` |

Timer: `CHALLENGE_PICK_TYPE_SECONDS`. Hết giờ → server/engine coi như thách sai (timeout).

**Figma**: 2 frame — holder vs non-holder (non-holder chỉ đọc + timer).

---

## 8. Prototype — R3 REVEAL / PENALTY / NEXT / TROPHY

| Phase | Tương tác chính | Ghi chú |
|-------|-----------------|--------|
| REVEAL | Offline: `onContinue` sau delay | Online: server đẩy phase |
| PENALTY | Chủ yếu đọc + animation stack | Có snapshot pile count |
| NEXT_TURN | Đọc | Auto advance offline |
| TROPHY_AWARDED | Trophy hero + refill copy | Auto advance offline |

---

## 9. Prototype — R4 END_GAME

| Control | Hành vi |
|---------|---------|
| Scoreboard rows | Hiển thị breakdown (nếu có từ store/state) |
| Play again / Leave | `router.push("/")` |

---

## 10. Chat & video

### Chat

- **Desktop (xl+)**: sidebar cố định 320px (`w-80`), không che main.
- **Mobile**: nút message header → sheet; backdrop đóng; focus vào input khi mở (đề xuất a11y).

### Video (chỉ online)

- Grid 2 cột, tối đa 3 slot peer + local; placeholder “waiting”.
- Trạng thái mic/cam/hangup rõ màu destructive khi tắt.

**Prototype gợi ý**: trạng thái “chưa connect” vs “đã connect” vs “lỗi” (`error` string).

---

## 11. Accessibility checklist (tối thiểu)

- [ ] Mọi nút icon (chat, theme, đóng sheet) có `aria-label`.
- [ ] Timer thách không chỉ dựa vào màu — có số giây hoặc progress text.
- [ ] `DeclareDialog`: focus trap, đóng bằng Esc, return focus về lá đã chọn nếu có thể.
- [ ] `prefers-reduced-motion`: giảm scale/spring mạnh trên phase transition (có thể tăng cường sau).

---

## 12. Checklist đưa vào Figma

1. Tạo **trang** theo: H1, R0–R4, O2, O3.
2. Dùng **component** cho: Header, GameTable shell, Hand card, Phase strip, Chat sheet, Video cell.
3. **Variant** theo `phase` và `challengeStep`.
4. **Prototype links**: H1 → R0; R0 Start → R1; R1 play → R2 claim → R2 pick → R3 reveal → R1/R4.
5. Xuất **cover** 16:9 cho mỗi frame làm thumbnail PR/storybook (optional).

---

## 13. Khoảng trống thiết kế (chưa có trong code — đề xuất)

Các ý sau **chưa** là wireframe chi tiết trong app; có thể là vòng design tiếp theo:

- **Empty state** khi mất kết nối socket (UI thân thiện hơn toast).
- **Host settings** (FR-015 PRD): panel riêng, không trộn lobby.
- **Tutorial overlay** lần đầu: giải thích claim race vs pick type trong ≤20s.
- **Picture-in-picture** video để mobile không chiếm nửa màn hình.

Ghi nhận trong backlog thiết kế khi ưu tiên.

---

*Tài liệu căn theo `game-room-client.tsx`, `GameTable.tsx`, `globals.css` tại thời điểm tạo.*
