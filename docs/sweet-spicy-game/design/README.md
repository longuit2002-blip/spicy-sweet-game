# Design — Sweet & Spicy (UI/UX)

Thư mục này tập trung **wireframe**, **đặc tả prototype** và **hướng dẫn đồng bộ với code** cho web app (`apps/web`). Không thay thế PRD; bổ sung lớp **thiết kế giao diện & tương tác** để designer/dev cùng làm việc.

## Nội dung

| Tài liệu | Mục đích |
|----------|----------|
| [layout.md](./layout.md) | Cấu trúc vùng, flex/stack, breakpoint, z-index, overflow — khớp `GameRoomClient` |
| [wireframes.md](./wireframes.md) | Khung màn hình (ASCII + Mermaid), vùng layout, luồng theo phase game |
| [prototype-ui-ux-spec.md](./prototype-ui-ux-spec.md) | Trạng thái tương tác, breakpoint, map component → file, checklist Figma/a11y |
| [visual-language-anime.md](./visual-language-anime.md) | Hướng phong cách **anime** + đọc brand **Sweet & Spicy** (“spicy sweet”) |
| [design-system-tactile-kawaii.md](./design-system-tactile-kawaii.md) | **Marshmallow Studio** — palette, type, depth, components, do/don’t (+ map repo) |
| [stitch-challenge-moment/](./stitch-challenge-moment/) | Export **Stitch** (Kawaii): PNG + HTML từ project *Challenge Moment* |

## Nguyên tắc (rút từ skill UI/UX dự án)

- **Touch**: vùng bấm tối thiểu ~44×44px cho hành động chính (claim thách, chọn lá).
- **Contrast**: chữ trên nền felt/table đạt ≥4.5:1 (token trong `globals.css`).
- **Motion**: tôn trọng `prefers-reduced-motion` cho animation phase (Framer Motion đã dùng ở room).
- **Consistency**: giữ “bàn chơi” (`GameTable`) làm **điểm nhìn trung tâm**; chat/video là **lớn phụ** không che timer thách.

## Liên kết nhanh code

- Shell phòng: `apps/web/src/app/room/[code]/game-room-client.tsx`
- Landing: `apps/web/src/app/home-client.tsx`
- Token màu / font: `apps/web/src/app/globals.css`

Cập nhật tài liệu này khi thêm màn hình mới (ví dụ public matchmaking, settings host).
