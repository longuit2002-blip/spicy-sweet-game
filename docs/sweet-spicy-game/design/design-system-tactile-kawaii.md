# Design System Strategy: The Tactile Kawaii Experience

## 1. Overview & Creative North Star

**Creative North Star: "The Marshmallow Studio"**

This design system rejects the clinical, rigid grids of traditional productivity software in favor of an organic, "squishy," and editorial layout. Inspired by high-end Japanese stationery and luxury vinyl toys, the interface should feel less like a "website" and more like a curated physical tabletop.

We break the "template" look by utilizing **intentional asymmetry**—where UI elements like character avatars or "cat-paw" action buttons break out of their containers—and **overlapping depth**, where soft-colored layers stack like thick cardstock. The goal is a high-end digital board game environment that feels cozy, premium, and undeniably tactile.

---

## 2. Colors: The Candy-Coated Palette

The palette is rooted in a cream-based warmth (`#fefcf4`), moving away from the "blue-white" of standard digital products.

- **Primary & Secondary Roles:** Use `primary` (#a14562) for key actions and `secondary` (#007257) for success states or "Wasabi" accents. These aren't flat; they are "candy-coated."
- **The "No-Line" Rule:** We do not use 1px solid borders to define sections. Sectioning is achieved purely through background shifts. For example, a `surface-container-low` game board area sits on a `surface` background. The change in tone is the boundary.
- **Surface Hierarchy & Nesting:** Treat the UI as layers of thick felt or paper.
  - **Base:** `surface` (#fefcf4).
  - **Main Containers:** `surface-container` (#f5f4eb).
  - **Floating Elements:** `surface-container-lowest` (#ffffff) to provide "pop" and highlights.
- **The "Glass & Gradient" Rule:** Main Call-to-Actions (CTAs) should use a subtle linear gradient from `primary` (#a14562) to `primary-container` (#fd8fad). For floating menu overlays, use `surface-container-low` at 80% opacity with a `20px` backdrop-blur to create a "milky glass" effect.

---

## 3. Typography: Whimsical Clarity

We utilize a pairing of **Plus Jakarta Sans** for structure and **Be Vietnam Pro** for readability, both chosen for their modern, rounded terminals that mimic the "bubbly" Kawaii aesthetic without sacrificing legibility.

- **Display (Lg/Md/Sm):** *Plus Jakarta Sans.* Use for game titles and "Cat-egory" headers. These should be treated as graphic elements—generously tracked and high-contrast against the soft backgrounds.
- **Headline & Title:** *Plus Jakarta Sans / Be Vietnam Pro.* These convey the "Brand Voice." Use `headline-lg` for big win states (e.g., "Victory! Purr-fect Game").
- **Body & Labels:** *Be Vietnam Pro.* Optimized for high-legibility during gameplay. The `body-md` is your workhorse for card descriptions and rules.
- **Visual Soul:** Typography should never be pure black. We use `on-surface` (#383833) to maintain a soft, ink-on-paper feel.

---

## 4. Elevation & Depth: Tonal Layering

Traditional shadows are too heavy for a Kawaii aesthetic. We use "Atmospheric Lift."

- **The Layering Principle:** Instead of shadows, nest a `surface-container-highest` (#e9e9de) card inside a `surface-container-low` (#fbf9f1) parent. The slight tonal dip creates perceived depth.
- **Ambient Shadows:** For "floating" elements like a cat-character pop-up, use an extra-diffused shadow: `box-shadow: 0 12px 32px rgba(161, 69, 98, 0.08);`. Note the tint: we use a fraction of the `primary` color, not grey, to keep the light feeling "warm."
- **The "Ghost Border" Fallback:** If a separation is needed for accessibility, use `outline-variant` (#bab9b2) at 15% opacity. It should be felt, not seen.
- **Pill-Shape Dominance:** Follow the Roundedness Scale religiously. Buttons are always `full` (pill-shaped), and game cards use `xl` (3rem) or `lg` (2rem) corners to emphasize the "squishy" nature of the design.

---

## 5. Components: Tactile & Friendly

### Buttons

- **Primary:** Pill-shaped, `primary` gradient, `headline-sm` text. On hover, use a slight scale-up (1.05x) to mimic a "squish."
- **Secondary:** `secondary-container` background with `on-secondary-container` text.

### Cards & Boards

**Strictly forbid divider lines.** Separate card sections (e.g., Cat Stats vs. Abilities) using a `1.4rem` (Spacing 4) vertical gap or a subtle background shift to `surface-container-high`.

### Chips

Use `lg` (2rem) roundedness. These should look like little candies. Use `tertiary-container` (#fdf2bb) for "Mustard" status indicators.

### Input Fields

Use `surface-container-highest` for the field background with no border. On focus, the field should "glow" with a 2px `primary-fixed` (#fd8fad) outer soft glow.

### Progress Bars

Use "Candy-Coated" bars. A `surface-container-highest` track with a `primary` fill. The "thumb" of the progress bar should be a small cat-paw icon or a circle with a `2rem` radius.

### Whimsical Overlays

Tooltips should never be rectangular. Use highly rounded `md` (1.5rem) containers with a small "tail" that looks like a speech bubble from a cat character.

---

## 6. Do's and Don'ts

### Do

- **Use "White Space" as a Tool:** Use the Spacing Scale (specifically `8` and `12`) to let the "cats" breathe.
- **Embrace Asymmetry:** Let character illustrations overlap the edges of containers or text blocks.
- **Keep it Soft:** Every corner must be rounded. If a "sharp" corner exists, it is a bug.
- **Color-Code Tones:** Use `secondary` (Wasabi) for positive actions and `primary` (Chili/Pink) for energy or attention.

### Don't

- **No Gambling Cues:** Avoid sharp suits (spades/clubs), dark velvets, or neon "casino" greens.
- **No 1px Lines:** Never use a solid dark line to separate content. Use the `surface` tokens.
- **No Pure Black/White:** Avoid `#000000` or `#ffffff` (except for the `lowest` container tier). Use the cream-based `surface` and charcoal `on-surface` tokens.
- **No Rigid Grids:** Avoid making every card the same height if the content doesn't require it. Let the layout feel "tumbled" like a bag of marbles.

---

## 7. Mapping tới codebase hiện tại (ghi chú triển khai)

Token và font trong doc này dùng **ngôn ngữ Material / design-tool** (`surface-container`, v.v.). Repo đang dùng **shadcn + HSL variables** trong `apps/web/src/app/globals.css` và font **Dela Gothic One + Inter**.

| Chiến lược doc | Hướng xử lý trong repo |
|----------------|-------------------------|
| Cream `#fefcf4`, primary `#a14562`, v.v. | Thêm bộ biến HSL (hoặc theme `kawaii-light`) song song `:root`; map `primary`, `background`, `card` — tránh phá theme dark hiện có cho đến khi quyết định một theme duy nhất. |
| Plus Jakarta Sans + Be Vietnam Pro | `next/font/google` trong `layout.tsx`; map `--font-display` / `--font-body` hoặc thêm `--font-heading-kawaii`. |
| No 1px borders | Giảm `border-border` trên panel; dùng `bg-muted/30` steps — **giữ** viền khi cần a11y (ghost border 15%). |
| Stitch Kawaii screens | Tham chiếu PNG/HTML trong [stitch-challenge-moment/](./stitch-challenge-moment/). |

*Tài liệu gốc do team/design cung cấp; mục 7 là bổ sung kỹ thuật cho monorepo.*
