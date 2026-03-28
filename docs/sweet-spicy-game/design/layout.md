# Layout — Sweet & Spicy (phòng chơi & shell)

Tài liệu mô tả **cấu trúc không gian** thực tế trong `apps/web`, để designer vẽ khung Figma khớp code và để dev không tách layout khỏi hệ thống.

---

## 1. Mô hình tổng thể: cột + lớp (z-index)

Phòng chơi (`GameRoomClient`) là **flex column full viewport**:

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER (shrink-0, sticky feel via border-b + blur)          │
├──────────────────────────────┬──────────────────────────────┤
│ MAIN (flex-1, min-h-0)       │ ASIDE CHAT (xl+, w-80)       │
│  └ column                    │  hidden < xl                 │
├──────────────────────────────┴──────────────────────────────┤
│ VIDEO PANEL (khi online, block dưới main — ngoài flex-row)   │
└─────────────────────────────────────────────────────────────┘
│ MOBILE CHAT: fixed overlay z-40 backdrop / z-50 sheet         │
│ DECLARE DIALOG: portal (Radix) — z theo theme dialog        │
└─────────────────────────────────────────────────────────────┘
```

### Gợi ý scale z-index (chuẩn hóa trong Figma & code)

| Lớp | z-index gợi ý | Ví dụ |
|-----|----------------|--------|
| Nền / bàn | 0 | `GameTable` felt |
| Nội dung bàn | 10 | Badge, pile |
| Header | 20 | `border-b` |
| Chat sheet backdrop | 40 | `fixed inset-0` |
| Chat sheet | 50 | `rounded-t-2xl` |
| Dialog / toast | 50+ | shadcn Dialog |

Hiện tại code dùng `z-40` / `z-50` cho chat mobile; **tránh** đặt video phủ lên sheet.

---

## 2. MAIN: trục dọc tabletop (`isTabletopLayoutPhase`)

Khi đang chơi bàn (lobby không dùng full stack này cho opponent bar), thứ tự **từ trên xuống**:

| # | Vùng | Tailwind / hành vi | Ghi chú UX |
|---|------|---------------------|------------|
| 1 | **OpponentBar** | `shrink-0`, `border-b`, `bg-muted/10` | Hàng ghế đối thủ; highlight lượt |
| 2 | **GameTable** | `shrink-0`, `p-2 sm:p-4` | Trung tâm thị giác; challenge mở rộng `min-h` |
| 3 | **Phase strip** | `flex-1`, `min-h` động: nhỏ khi `CHALLENGE_PHASE` | Tránh chiếm chỗ khi bàn đang “nặng” |
| 4 | **ActionLog** | `shrink-0`, `px-2 pb-2` | Collapse mặc định trên mobile compact |
| 5 | **Local rail** | `shrink-0`, `border-t`, gradient | `PlayerSeat` + `PlayerHand` |

### Phase strip — quy tắc chiều cao

- `CHALLENGE_PHASE`: `min-h-[72px] sm:min-h-[88px]` — vì UI thách chính nằm **trên bàn**, strip chỉ hint.
- Các phase khác: `min-h-[min(24vh,180px)]` (mobile) / `min(28vh,220px)` (sm+) — chừa không gian cho copy + animation.

### Local rail — desktop vs mobile

- **sm+**: `flex-row`, `items-end` — seat trái (max ~220px), hand `flex-1` scroll ngang.
- **mobile**: `flex-col` — seat trên, hand dưới, vẫn **scroll ngang** cho lá.

---

## 3. Breakpoint map (trùng code)

| Ngưỡng | Biến / hook | Ảnh hưởng |
|--------|-------------|-----------|
| `max-width: 767px` | `useMediaQuery`, `isMobileCompact` | ActionLog collapsed, `PlayerSeat` compact |
| `lg` (1024px) | Tailwind `lg:flex-row` trên `main` | Chia main vs sidebar region (chat vẫn ẩn đến xl) |
| `xl` (1280px) | `xl:flex` trên `aside` chat | Chat cố định phải; dưới xl chỉ icon + sheet |

**Figma**: đặt 3 frame chính — **390** (mobile), **768** (tablet boundary), **1440** (desktop + chat).

---

## 4. Spacing & grid

- **Padding ngang shell**: `px-2` → `sm:px-4` (game room).
- **Header**: `px-3 py-3` → `sm:px-4`.
- **Container landing**: `max-w-md`, `p-4` — một cột trung tâm.
- **Game table** inner: `px-3 sm:px-4`, `gap-4` giữa các cụm metadata.

Không dùng CSS Grid cho toàn trang phòng; **flex** để vùng dưới (`hand`) có thể co giãn theo viewport.

---

## 5. Overflow & scroll

- `main`: `overflow-hidden` — scroll nằm trong **ChatPanel**, **ActionLog**, **hand**, không scroll cả page (tránh mất header).
- **PlayerHand**: cuộn ngang; đảm bảo **padding đuôi** để lá cuối không sát mép (kiểm tra trong component).

---

## 6. Safe area (mobile)

- Chat sheet: `max-h-[min(56vh,420px)]` — tránh che nút home gesture; designer có thể thêm `pb-safe` sau nếu dùng `env(safe-area-inset-bottom)` trong CSS.

---

## 7. Landing (`HomeClient`)

- Một cột: `flex min-h-screen items-center justify-center`.
- Không sidebar; theme + language trên cùng card logic.

---

## 8. Checklist đối chiếu khi đổi layout

- [ ] `CHALLENGE_PHASE` vẫn đọc được timer khi bàn cao (không clip bởi phase strip).
- [ ] Chat sheet không che nút Claim trên bàn (z-order).
- [ ] `OpponentBar` không đẩy `GameTable` ra ngoài viewport trên 390px (giảm padding hoặc compact seats).
- [ ] Video strip: xem xét **collapsible** nếu chiếm quá nhiều chiều cao mobile (backlog).

---

*Căn cứ: `game-room-client.tsx` (header, main, aside, sheet, local rail).*
