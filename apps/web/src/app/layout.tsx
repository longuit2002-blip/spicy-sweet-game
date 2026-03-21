import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Dela_Gothic_One, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const display = Dela_Gothic_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Sweet & Spicy",
  description: "Real-time multiplayer bluffing card game",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} antialiased min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
