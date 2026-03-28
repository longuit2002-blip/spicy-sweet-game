import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "cursive"],
        body: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chili: "hsl(var(--chili))",
        "chili-glow": "hsl(var(--chili-glow))",
        lemon: "hsl(var(--lemon))",
        "lemon-glow": "hsl(var(--lemon-glow))",
        avocado: "hsl(var(--avocado))",
        "avocado-glow": "hsl(var(--avocado-glow))",
        "card-face": "hsl(var(--card-face))",
        "card-back": "hsl(var(--card-back))",
        "surface-felt": "hsl(var(--surface-felt))",
        "surface-rail": "hsl(var(--surface-rail))",
        "trophy-gold": "hsl(var(--trophy-gold))",
        "trophy-glow": "hsl(var(--trophy-glow))",
        /* Marshmallow Studio surface hierarchy */
        "neko-pink": "hsl(var(--neko-pink))",
        "surface-dim": "hsl(var(--surface-dim))",
        "surface-container-lowest": "hsl(var(--surface-container-lowest))",
        "surface-container-low": "hsl(var(--surface-container-low))",
        "surface-container": "hsl(var(--surface-container))",
        "surface-container-high": "hsl(var(--surface-container-high))",
        "surface-container-highest": "hsl(var(--surface-container-highest))",
        "outline-variant": "hsl(var(--outline-variant))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "3rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 10px hsl(12 85% 55% / 0.3)" },
          "50%": { boxShadow: "0 0 25px hsl(12 85% 55% / 0.6)" },
        },
        "trophy-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 0 0 hsl(43 96% 56% / 0.35)",
            transform: "scale(1)",
          },
          "50%": {
            boxShadow: "0 0 20px 2px hsl(43 100% 72% / 0.45)",
            transform: "scale(1.02)",
          },
        },
        /** Empty play slot (PLAYER_TURN): subtle “drag here” invite without a card-back preview. */
        "play-drop-slot-invite": {
          "0%, 100%": {
            borderColor: "hsl(var(--primary) / 0.32)",
            backgroundColor: "hsl(var(--muted) / 0.12)",
          },
          "50%": {
            borderColor: "hsl(var(--primary) / 0.52)",
            backgroundColor: "hsl(var(--muted) / 0.24)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "trophy-pulse": "trophy-pulse 2.4s ease-in-out infinite",
        "play-drop-slot-invite": "play-drop-slot-invite 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
