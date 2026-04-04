import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { Be_Vietnam_Pro, Dela_Gothic_One, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

function resolveInitialLanguage(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): "en" | "vi" {
  if (cookieValue === "vi" || cookieValue === "en") return cookieValue;
  const al = acceptLanguage?.toLowerCase() ?? "";
  if (al.startsWith("vi")) return "vi";
  return "en";
}

const display = Dela_Gothic_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const kawaiiDisplay = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-kawaii-display",
});

const kawaiiBody = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-kawaii-body",
});

export const metadata: Metadata = {
  title: "Sweet & Spicy",
  description: "Real-time multiplayer bluffing card game",
};

// Material Symbols Outlined + Rounded fonts
const MATERIAL_SYMBOLS_HREF =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght@20..48,100..700&family=Material+Symbols+Rounded:opsz,wght@20..48,100..700&display=block";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const initialLanguage = resolveInitialLanguage(
    cookieStore.get("i18nextLng")?.value,
    hdrs.get("accept-language"),
  );

  return (
    <html lang={initialLanguage} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={MATERIAL_SYMBOLS_HREF} />
      </head>
      <body
        className={`${display.variable} ${body.variable} ${kawaiiDisplay.variable} ${kawaiiBody.variable} antialiased min-h-dvh`}
        suppressHydrationWarning
      >
        <Providers initialLanguage={initialLanguage}>{children}</Providers>
      </body>
    </html>
  );
}
