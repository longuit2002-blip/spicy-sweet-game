"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserStore, loginAsGuest } from "@/stores/userStore";
import { changeLanguage, getCurrentLanguage } from "@/lib/i18n";
import { useTheme } from "next-themes";
import { Loader2, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function HomeClient() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const { user } = useUserStore();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [joinCode, setJoinCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setNickname(user.nickname);
    }
  }, [user]);

  const toggleLanguage = () => {
    const newLang = getCurrentLanguage() === "vi" ? "en" : "vi";
    changeLanguage(newLang);
  };

  const handleCreate = async () => {
    if (!nickname.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      await loginAsGuest(nickname.trim());
      router.push("/room/new");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim() || !joinCode.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      await loginAsGuest(nickname.trim());
      router.push(`/room/${joinCode.trim().toUpperCase()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background p-4"
      style={{ background: "var(--gradient-dark)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md px-1 sm:px-0"
      >
        <div className="text-center mb-9 sm:mb-10">
          <motion.h1
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="font-display text-5xl sm:text-6xl text-gradient-fire mb-3 tracking-tight"
          >
            Sweet & Spicy
          </motion.h1>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            🌶️ {t("app.subtitle")} ⚫
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          <Button variant="outline" size="sm" onClick={toggleLanguage} className="gap-2">
            <span>{getCurrentLanguage() === "vi" ? "🇻🇳" : "🇬🇧"}</span>
            <span>{getCurrentLanguage() === "vi" ? "Tiếng Việt" : "English"}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="gap-2"
          >
            {(theme === "light" || resolvedTheme === "light") ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {(theme === "light" || resolvedTheme === "light") ? "Dark" : "Light"}
            </span>
          </Button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm text-center"
          >
            {error}
          </motion.div>
        )}

        <div
          className={cn(
            "space-y-6 rounded-2xl border border-border/80 bg-card/95 p-6 shadow-card backdrop-blur-sm sm:p-7",
          )}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="home-nickname">
              {t("home.nickname")}
            </label>
            <Input
              id="home-nickname"
              placeholder={t("home.enterNickname")}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={16}
              disabled={isLoading}
              className="h-11 bg-muted/80 border-border text-foreground placeholder:text-muted-foreground/50"
            />
          </div>

          <Button
            type="button"
            className="w-full bg-gradient-fire text-primary-foreground font-semibold text-lg h-12 shadow-fire"
            onClick={handleCreate}
            disabled={!nickname.trim() || isLoading}
          >
            {isLoading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                {t("home.creatingRoom")}
              </span>
            ) : (
              t("home.createRoom")
            )}
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-xs uppercase tracking-wider">{t("home.joinRoom")}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex gap-2">
            <Input
              placeholder={t("home.enterRoomCode")}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
              disabled={isLoading}
              className="h-11 min-w-0 flex-1 bg-muted/80 border-border text-foreground placeholder:text-muted-foreground/50 uppercase tracking-widest text-center font-bold"
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0 px-5 sm:px-6 font-semibold"
              onClick={handleJoin}
              disabled={!nickname.trim() || joinCode.length < 4 || isLoading}
            >
              {t("home.join")}
            </Button>
          </div>
        </div>

        <p className="text-center text-muted-foreground/50 text-xs mt-6">{t("home.footer")}</p>
      </motion.div>
    </div>
  );
}
