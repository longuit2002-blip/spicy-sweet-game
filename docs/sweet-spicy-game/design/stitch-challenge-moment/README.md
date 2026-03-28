# Stitch — Challenge Moment (Kawaii)

Nguồn: **Google Stitch** MCP (`user-stitch` / `get_screen`). File trong thư mục này được tải bằng `curl -L` từ URL trả về API.

## Project

| Trường | Giá trị |
|--------|---------|
| **Title** | Challenge Moment |
| **Project ID** | `473651384390584194` |
| **Resource name** | `projects/473651384390584194` |

## Screens đã import (4/5)

`list_screens` chỉ trả về **4** màn. Màn **Design System** với ID `asset-stub-assets-01af2e0a6f824f05853ef20daf6beaa4-1774155832578` **không** phải `projects/.../screens/{id}` — `get_screen` báo *Requested entity was not found*. Có thể đó là **asset stub** trong UI Stitch, không export qua API; bạn có thể xuất tay từ Stitch hoặc dùng screen ID thật nếu có trong app.

| # | Tiêu đề Stitch | Screen ID | Screenshot | HTML |
|---|----------------|-----------|------------|------|
| 1 | Game Lobby (Kawaii) | `681fcb976f5f495d8321eea14c990846` | `01-game-lobby.png` | `01-game-lobby.html` |
| 2 | Main Game Board (Kawaii) | `4d66f36531a74c4ebbdef6d1343616d0` | `02-main-game-board.png` | `02-main-game-board.html` |
| 3 | Challenge Moment (Kawaii) | `f0cc869d96bd443ab29d8e3f39ccd982` | `03-challenge-moment.png` | `03-challenge-moment.html` |
| 4 | Game Scoreboard (Kawaii) | `02d76410e3674f82b5c368fe8b8efde7` | `04-game-scoreboard.png` | `04-game-scoreboard.html` |

Kích thước thiết kế (theo API): **2560×2048** (Scoreboard **2560×2746**), `deviceType: DESKTOP`.

## Cách dùng

- **PNG**: tham chiếu visual / đặt vào Figma làm reference layer.
- **HTML**: prototype tĩnh từ Stitch; có thể mở trực tiếp trong browser (font/CDN phụ thuộc nội dung file).

## Làm mới file

Khi URL hết hạn, gọi lại MCP `get_screen` với:

`name`: `projects/473651384390584194/screens/{screenId}`

rồi `curl -L` `screenshot.downloadUrl` và `htmlCode.downloadUrl`.
