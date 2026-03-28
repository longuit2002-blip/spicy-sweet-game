# Phong cách thị giác — hướng Anime cho Sweet & Spicy

## Sweet & Spicy / “Spicy Sweet” là gì?

Trong dự án này, **Sweet & Spicy** là tên game bài bluff: **ngọt** (cảm giác vui, “party”, màu ấm, đường/vàng) và **cay** (gia vị ớt/tiêu/wasabi, risk, tension). Người chơi hay nói nhầm **spicy sweet** — vẫn là **cùng một đôi contrast** rất hợp **anime**: nhân vật dễ thương + hiệu ứng năng lượng mạnh khi thách bài hoặc lộ bluff.

Tài liệu này **không** bắt buộc đổi code ngay; là **hướng nghệ thuật** để Figma + CSS/token đi cùng một hướng.

---

## 1. Trục nghệ thuật (dual mood)

| Trục | Anime / UI | Gắn với game |
|------|------------|----------------|
| **Sweet** | Pastel, bo tròn lớn, viền mềm, sparkle nhẹ, typography “friendly” | Lobby, accept, trophy, UI yên |
| **Spicy** | Saturation cao hơn, glow đỏ/cam, motion snap, “impact frame” khi reveal | Challenge, penalty, timer |

**Quy tắc**: một màn hình có thể có cả hai — **nền sweet**, **accent spicy** trên CTA và lá bài đang tranh chấp.

---

## 2. Màu (đề xuất mở rộng token)

Giữ cấu trúc HSL trong `globals.css`; có thể thêm biến **semantic anime** (ví dụ):

- `--anime-sky`: nền gradient nhạt (xanh baby / hồng đào) cho shell — tách khỏi felt bàn.
- `--anime-ink`: viền “cel” đậm cho thẻ bài / dialog (`hsl` tối, opacity ~0.85).
- `--anime-highlight`: streak vàng/chanh cho điểm nhấn (không thay thế `--trophy-gold`, mà **kết hợp**).

**Chất bài hiện có** (`chili`, `pepper`, `wasabi`) giữ nguyên vai trò; anime hóa bằng:

- Viền **2px** + **inner highlight** (giả ánh sáng cel-shading) trên `SpiceCard`.
- Glow pulse khi lá được chọn (đã có hướng `pulse-glow` — có thể tăng “pop” một nhịp ngắn 150ms).

---

## 3. Typography

Hiện tại: **Dela Gothic One** (display) + **Inter** (body) — mạnh, có cá tính nhưng hơi “Western poster”.

Hướng anime (vẫn đọc tốt tiếng Việt / EN):

| Vai trò | Gợi ý Google Fonts | Ghi chú |
|---------|---------------------|---------|
| Display / tiêu đề | `Yusei Magic`, `Zen Maru Gothic`, hoặc `M PLUS Rounded 1c` | Tròn, “friendly”, gợi slice-of-life |
| Body | `Nunito`, `Quicksand`, hoặc giữ `Inter` | Nếu display đã rất đặc trưng, body nên đơn giản |

**Implementation**: thêm biến `--font-display-anime` (optional theme) hoặc đổi `layout.tsx` font loader — làm **một PR riêng** để kiểm tra cân đối với shadcn.

---

## 4. Hình học & đồ họa UI

- **Bo góc**: tăng nhẹ `--radius` (ví dụ 0.75rem → 1rem) cho card/dialog — cảm giác “sticker”.
- **Viền cel**: `border-2 border-foreground/15` trên `Card`, `Button` outline; shadow **cứng một lớp** thay vì blur dày (optional).
- **Pattern**: screen-tone **rất mờ** (5% opacity) trên vùng phase strip — tránh ồn trên mobile.
- **Sticker / mascot**: vị trí gợi ý — góc dưới trái lobby hoặc cạnh trophy (asset sau; placeholder trong Figma).

---

## 5. Motion (Framer Motion)

Đã có `SNAPPY_SPRING`, phase transition — anime hóa bằng:

- **Overshoot nhỏ** khi trophy pop (scale 0.6 → 1.05 → 1).
- **Speed line** hoặc **radial flash** 1 frame khi `REVEAL` — SVG/CSS, tắt khi `prefers-reduced-motion`.

Không lạm dụng: **timer thách** phải đọc số giây rõ, không rung liên tục.

---

## 6. Áp dụng theo màn hình

| Màn | Sweet | Spicy |
|-----|-------|-------|
| Landing | Nền pastel gradient, title mềm | Viền lửa nhẹ trên logo |
| Lobby | Pill player dạng “badge sticker” | Host crown animation nhỏ |
| GameTable | Felt có thể hơi “tím đêm” anime thay vì casino | Challenge bell + timer ring nổi bật |
| Reveal / Penalty | — | Contrast cao, flash ngắn |
| End | Confetti optional (CSS) | Bảng điểm vẫn đọc được |

---

## 7. Không làm (để tránh “AI slop”)

- Không phủ emoji thay icon SVG cho mọi nút.
- Không gradient 7 màu trên toàn app.
- Không font chữ “manga crack” khó đọc cho số bài và timer.

---

## 8. Bước triển khai gợi ý (theo thứ tự)

1. **Token + utilities** trong `globals.css` (`--anime-*`, class `.border-cel`, `.bg-anime-sky`).
2. **`SpiceCard` + `GameTable`**: viền + highlight cel.
3. **Landing + lobby**: nền + display font.
4. **Reveal**: một hiệu ứng impact có `reduced-motion` fallback.

---

## 9. Tham chiếu mood (không cần copy y hệt)

- Party game anime: năng lượng cao, UI rõ ràng, nhân vật phụ trợ cảm xúc.
- “Food wars” energy gợi **cay**; “slice of life café” gợi **ngọt** — trộn hai tông trong cùng brand Sweet & Spicy.

---

Để chi tiết token, typography và component rules (cream palette, no-line, pill CTAs), xem **[design-system-tactile-kawaii.md](./design-system-tactile-kawaii.md)** (*The Marshmallow Studio*).

*Tài liệu đi kèm [layout.md](./layout.md) và [wireframes.md](./wireframes.md).*
