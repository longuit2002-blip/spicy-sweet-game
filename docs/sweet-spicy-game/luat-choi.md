# Luật chơi Sweet & Spicy

Tài liệu này tổng hợp **luật chơi thực tế** của game theo mã nguồn (`@sweet-spicy/game-logic`, `@sweet-spicy/shared-types`) và PRD nội bộ. Khi PRD khác với code, phần **triển khai hiện tại** được coi là chuẩn cho bản online.

---

## 1. Tổng quan

Sweet & Spicy là game bài **nhiều người (2–6)**, kết hợp **bluff** (nói dối về lá đánh) và **thách thức**: người chơi đánh một lá **úp**, tuyên bố **loại gia vị** và **số**; người khác có thể thách — nếu tuyên bố sai theo tiêu chí được chọn, người thách có lợi; nếu đúng, người thách chịu hậu quả.

---

## 2. Mục tiêu và kết thúc ván

- **Kết thúc ván** khi **một trong hai** điều kiện xảy ra:
  - **Không còn trophy** để trao (`trophiesRemaining` về 0), hoặc
  - **Chồng bài rút cạn** (`drawPile` hết).
- **Người thắng**: (các) người có **điểm cuối cao nhất** (có thể **hòa** nhiều người cùng điểm tối đa).
- **Điểm cuối** của mỗi người = **điểm từ chồng đã thắng** (`wonPile`) **trừ** **phạt** vì **wild còn trên tay** (xem mục 9).

---

## 3. Phòng và bắt đầu

- **Số người**: tối thiểu **2**, tối đa **6** (mặc định).
- **Mã phòng**: chuỗi ký tự (ví dụ 4 ký tự) để mời bạn; chi tiết vận hành phòng xem PRD / tài liệu kỹ thuật.
- Khi host **bắt đầu game**: xáo bài, chia bài, chọn **ngẫu nhiên** người đi đầu.

---

## 4. Bộ bài và các loại lá

### 4.1. Bài “chính” (main deck)

Sau khi xáo, gồm:


| Thành phần                | Mô tả                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| **Bài thường**            | **30 lá**: **3 chất** × **10 số** (số từ **1** đến **10**).                              |
| **Wild chất (wild-suit)** | **5 lá**: khi **kiểm tra chất** trong thách thức, coi như **khớp mọi chất** đã tuyên bố. |
| **Wild số (wild-number)** | **5 lá**: khi **kiểm tra số**, coi như **khớp mọi số** đã tuyên bố.                      |


**Chất (SpiceType)** trong game: `chili`, `pepper`, `wasabi` (tên hiển thị có thể là Ớt / Tiêu / Wasabi tùy ngôn ngữ UI).

### 4.2. Total Wild (siêu joker)

- Có **6 lá Total Wild** trong một **chồng riêng**; khi chia bài đầu ván, **mỗi người nhận thêm 1 Total Wild** cùng với 5 lá từ main deck (tức **6 lá tay lúc bắt đầu** gồm 5 “thường/main” + 1 Total Wild).
- **Số lá Total Wild chưa chia** nằm ở **dự trữ** (`supremeReserve`) để có thể **bổ sung** trong một số tình huống phạt (xem mục 7).
- **Total Wild** khi thách theo **chất** hoặc **số** đều được coi là **pass** cả hai kiểm tra (rất khó “bắt bài” bằng một thách đơn).

### 4.3. Trophy (cúp)

- Không nằm trong main deck lúc chia; được **tạo khi trao thưởng** (mục 8).
- Trong ván có tối đa **3 trophy** (`TOTAL_TROPHIES = 3`).

---

## 5. Cấu trúc vòng — “round” và chất khóa

- Khi **không có** `lockedSuit` (ví dụ đầu ván, hoặc sau khi một vụ **thách thức** kết thúc và state reset): đang ở **mở vòng mới**.
- **Lần tuyên bố đầu tiên** của vòng mới:
  - **Số** tuyên bố chỉ được trong khoảng **1 → OPENING_RANK_MAX** (**3**).
  - **Chất** có thể **bất kỳ** trong ba loại.
- Sau khi có một lần chơi được **chấp nhận** (không bị thách hoặc đã xử lý xong), **chất** của vòng được **khóa** (`lockedSuit`) bằng **chất đã tuyên bố** ở lần mở vòng đó.
- Trong vòng đã khóa chất:
  - Mọi **tuyên bố** sau phải cùng **chất** đã khóa.
  - **Số** phải **tăng dần** so với **tuyên bố đã được giải quyết gần nhất** (`lastResolvedDeclaration`): số mới phải **lớn hơn** số trước, trong giới hạn **1–10**.
  - Nếu số trước đã là **10**, vòng **reset bậc số**: lần tiếp theo chỉ được tuyên bố số từ **1** đến **RANK_RESET_MAX_INCLUSIVE** (**3**).

**Lưu ý**: Luật trên áp cho **tuyên bố**; lá **thật** trên tay có thể khác — đó là chỗ để **bluff**.

---

## 6. Lượt đi — đánh bài và tuyên bố

1. Đến lượt (`PLAYER_TURN`), người chơi chọn **một lá** trên tay và **tuyên bố** một cặp **(chất, số)** thỏa điều kiện mục 5.
2. Lá được đưa vào vùng **đang chơi** (úp), kèm tuyên bố — các người khác **không** biết lá thật cho đến khi **lộ bài** (thách hoặc kết thúc bước).
3. Game chuyển sang **giai đoạn thách thức** (`CHALLENGE_PHASE`).

---

## 7. Thách thức (challenge) — hai bước

Thời gian tính bằng **giây**, đồng bộ với tick server (mặc định **1 giây** một nhịp).

### Bước A — “Claim race” (tranh quyền thách)

- Trong **CHALLENGE_CLAIM_RACE_SECONDS** (**5 giây**), người chơi **không phải** người vừa đánh có thể **claim** (giành quyền thách).
- **Ai claim trước (theo server) thì giữ quyền**; người **không được** tự thách chính mình.
- Hết giờ mà **không ai** claim → **tuyên bố được chấp nhận** (tương đương mọi người “bỏ qua” thách).

### Bước B — Chọn kiểu thách (suit hay number)

- Người giữ quyền có **CHALLENGE_PICK_TYPE_SECONDS** (**5 giây**) để chọn thách một trong hai:
  - `**suit`**: kiểm tra **chất** thật của lá có khớp **chất đã tuyên bố** không (wild-suit và total-wild **luôn pass** phần chất).
  - `**number`**: kiểm tra **số** thật có khớp **số đã tuyên bố** không (wild-number và total-wild **luôn pass** phần số).
- **Hết giờ** mà chưa chọn → xử như **thách sai** (xử lý giống thách thất bại; trong code, mặc định gắn kiểu `suit` và `challengeCorrect: false`).

### Kết quả thách (sau REVEAL)

- **Thách đúng** (`challengeCorrect === true`): nghĩa là theo **tiêu chí đã chọn**, lá thật **không** thỏa tuyên bố — người thách **thắng** chồng bài trên bàn (các lá đã tích lũy + lá vừa đánh được đưa vào `wonPile` của người thắng).
- **Thách sai**: người **tuyên bố** **thắng** chồng bàn; người thách **rút phạt** **PENALTY_DRAW_COUNT** (**2 lá**) từ chồng rút. Nếu sau khi rút **tay không còn Total Wild** và **dự trữ supreme** còn — có thể **thêm 1 Total Wild** từ dự trữ vào tay (cơ chế “hoàn trả” joker).

Sau xử lý thách, **chất khóa và lastResolvedDeclaration được xóa** — **vòng mới** bắt đầu; **lượt tiếp theo** thuộc về **người thua** vụ vừa rồi (`currentPlayerIndex` = người “loser” theo engine).

Có **pause** **PHASE_STEP_PAUSE_SECONDS** (**2 giây**) giữa một số bước chuyển phase (REVEAL → PENALTY, v.v.) để UI/animation.

---

## 8. Không ai thách — chấp nhận tuyên bố

- Nếu không ai claim trong claim race → **accept**:
  - Lá vừa đánh được **thêm vào `tablePile`** (chồng bàn, chưa vào `wonPile` của ai).
  - `lastResolvedDeclaration` cập nhật để **khóa luật bậc số** cho các lượt tiếp theo trong cùng chất (mục 5).
  - Lượt chuyển cho **người kế tiếp theo chiều kim đồng hồ**.

### Hết bài tay sau khi đánh (trophy & refill)

Sau khi đánh, nếu người đó **hết bài trên tay**:

- Nếu lá vừa đánh **không phải** Total Wild **và** vẫn còn trophy:
  - Nhận **1 lá trophy** (điểm cao ở cuối ván), tăng `trophyCount`, **rút bù** **REFILL_HAND_SIZE** (**5 lá**) từ chồng rút, phase tạm **TROPHY_AWARDED** rồi về lượt chơi.
- Trường hợp khác (ví dụ kết thúc bằng Total Wild hoặc hết trophy): **chỉ rút bù 5 lá** (không thêm trophy), logic chi tiết theo `acceptDeclaration` trong engine.

Nếu sau bước này **thỏa điều kiện kết thúc ván** (mục 2) → **END_GAME**.

---

## 9. Tính điểm cuối ván

Khi vào `END_GAME`, với mỗi người:

- **Điểm từ `wonPile`**:
  - Mỗi lá **thường**: **+1** (`NORMAL_CARD_POINTS`).
  - Mỗi lá **wild** (wild-suit, wild-number, total-wild trong pile): **+5** (`WILD_CARD_POINTS`).
  - Mỗi **trophy**: **+10** (`TROPHY_CARD_POINTS`).
- **Trừ điểm** vì **wild còn trên tay** lúc kết thúc: mỗi lá wild trên tay **-5** (`WILD_CARD_PENALTY`).

**Tổng điểm** = điểm pile − phạt wild trên tay. **Cao nhất** thắng; **hòa** nếu cùng điểm tối đa.

---

## 10. Các phase (trạng thái) — tham chiếu kỹ thuật

Theo `GAME_PHASE` trong shared-types:

`LOBBY` → `PLAYER_TURN` → `CHALLENGE_PHASE` → (có thể) `REVEAL` → `PENALTY` → `PLAYER_TURN` / `END_GAME`; giữa chừng có `NEXT_TURN`, `TROPHY_AWARDED` tùy nhánh accept.

---

## 11. Bảng hằng số (triển khai hiện tại)


| Hằng số                                 | Giá trị | Ý nghĩa                                              |
| --------------------------------------- | ------- | ---------------------------------------------------- |
| `MIN_PLAYERS_TO_START`                  | 2       | Tối thiểu để start                                   |
| `DEFAULT_ROOM_MAX_PLAYERS`              | 6       | Tối đa phòng                                         |
| `INITIAL_HAND_SIZE`                     | 5       | Số lá rút từ main deck khi chia                      |
| `REFILL_HAND_SIZE`                      | 5       | Số lá rút bù sau trophy / nhánh refill               |
| `OPENING_RANK_MAX`                      | 3       | Số tối đa khi mở vòng mới                            |
| `MAX_DECLARATION_RANK`                  | 10      | Số tối đa trong vòng đã khóa chất                    |
| `RANK_RESET_MAX_INCLUSIVE`              | 3       | Sau khi tuyên bố 10, bậc số reset tối đa             |
| `CHALLENGE_CLAIM_RACE_SECONDS`          | 5       | Thời gian tranh claim                                |
| `CHALLENGE_PICK_TYPE_SECONDS`           | 5       | Thời gian chọn suit/number                           |
| `CHALLENGE_PHASE_COUNTDOWN_SECONDS`     | 5       | Tham chiếu UI/legacy; claim/pick tách riêng như trên |
| `PENALTY_DRAW_COUNT`                    | 2       | Số lá phạt khi thách sai                             |
| `PHASE_STEP_PAUSE_SECONDS`              | 2       | Pause giữa bước                                      |
| `TOTAL_TROPHIES`                        | 3       | Trophy tối đa trong ván                              |
| `TOTAL_WILD_CARDS`                      | 6       | Total Wild trong pool                                |
| `WILD_SUIT_CARDS` / `WILD_NUMBER_CARDS` | 5 / 5   | Số lá wild trong main deck                           |


---

## 12. Khác biệt so với PRD (tham khảo)

PRD (bản nháp) có đoạn tóm tắt phụ lục nêu **3 chất** kiểu Chili / Pepper / **Lemon** và mô tả điểm **+1 khi không bị thách**, **+3/-1** khi kết ván. **Bản code hiện tại** dùng **wasabi** thay lemon, có **wild / total-wild / trophy**, **claim race + chọn suit/number**, và **điểm cuối** dựa trên **wonPile + điểm lá + phạt wild tay** như mục 9 — không dùng công thức +3/−1 của PRD appendix.

---

*Tài liệu đồng bộ với engine: `packages/game-logic/src/engine.ts`, `packages/game-logic/src/game-timing.ts`, `packages/shared-types/src/game.ts`.*