"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { Loader2, Moon, Sun } from "lucide-react";
import { ROOM_CODE_MAX_LENGTH, ROOM_CODE_MIN_LENGTH } from "@sweet-spicy/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/hooks/useHydrated";
import {
  changeLanguage,
  getCurrentLanguage,
} from "@/lib/i18n";
import {
  NEW_ROOM_ROUTE_SEGMENT,
  PLAYER_NICKNAME_MAX_LENGTH,
  ROOM_CODE_SEARCH_PARAM,
} from "@/lib/game-room.constants";
import { cn } from "@/lib/utils";
import { loginAsGuest, useUserStore } from "@/stores/userStore";

const THEME_MODE = {
  DARK: "dark",
  LIGHT: "light",
} as const;

const HOME_UI_COPY = {
  en: {
    createRoomError: "Failed to create room",
    joinSectionLabel: "Join Room",
    joinRoomHint: "Enter a room code first. You will choose your player name on the next screen.",
    languageLabel: "Language",
    languageName: "English",
    nicknameHint: "This becomes your player name in the room.",
    themeDarkLabel: "Dark",
    themeLightLabel: "Light",
    themeToggleLabel: "Toggle theme",
  },
  vi: {
    createRoomError: "Không tạo được phòng",
    joinSectionLabel: "Vào phòng",
    joinRoomHint:
      "Nhập mã phòng trước. Bạn sẽ chọn tên hiển thị ở bước tiếp theo.",
    languageLabel: "Ngôn ngữ",
    languageName: "Tiếng Việt",
    nicknameHint: "Tên này sẽ hiển thị trong phòng như tên người chơi của bạn.",
    themeDarkLabel: "Tối",
    themeLightLabel: "Sáng",
    themeToggleLabel: "Đổi giao diện",
  },
} as const;

export function HomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, i18n } = useTranslation("common");
  const user = useUserStore((state) => state.user);
  const hasUserHydrated = useUserStore((state) => state.hasHydrated);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const hydrated = useHydrated();

  const [joinCode, setJoinCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasUserHydrated && user) {
      setNickname(user.nickname);
    }
  }, [hasUserHydrated, user]);

  useEffect(() => {
    const presetRoomCode =
      searchParams.get(ROOM_CODE_SEARCH_PARAM)?.trim().toUpperCase() ?? "";
    if (!presetRoomCode) {
      return;
    }
    setJoinCode((currentCode) => (currentCode === presetRoomCode ? currentCode : presetRoomCode));
  }, [searchParams]);

  const currentLanguage =
    hydrated ? getCurrentLanguage() : (i18n.resolvedLanguage ?? "en");
  const languageCode = currentLanguage === "vi" ? "vi" : "en";
  const homeUiCopy = languageCode === "vi" ? HOME_UI_COPY.vi : HOME_UI_COPY.en;
  const isLightTheme =
    hydrated &&
    (theme === THEME_MODE.LIGHT || resolvedTheme === THEME_MODE.LIGHT);

  const toggleLanguage = () => {
    if (!hydrated) {
      return;
    }
    changeLanguage(currentLanguage === "vi" ? "en" : "vi");
  };

  const handleCreate = async () => {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await loginAsGuest(trimmedNickname);
      router.push(`/room/${NEW_ROOM_ROUTE_SEGMENT}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : homeUiCopy.createRoomError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = () => {
    const normalizedCode = joinCode.trim().toUpperCase();
    if (normalizedCode.length < ROOM_CODE_MIN_LENGTH) {
      return;
    }

    setError("");
    router.push(`/room/${normalizedCode}`);
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
        <div className="mb-9 text-center sm:mb-10">
          <motion.h1
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="mb-3 font-display text-5xl tracking-tight text-gradient-fire sm:text-6xl"
          >
            {t("app.title")}
          </motion.h1>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("app.subtitle")}
          </p>
        </div>

        <div className="mb-6 flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="gap-2"
            disabled={!hydrated}
          >
            {hydrated ? (
              <>
                <span>{languageCode.toUpperCase()}</span>
                <span>{homeUiCopy.languageName}</span>
              </>
            ) : (
              <span>{homeUiCopy.languageLabel}</span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-label={homeUiCopy.themeToggleLabel}
            onClick={() =>
              setTheme(isLightTheme ? THEME_MODE.DARK : THEME_MODE.LIGHT)
            }
            className="gap-2"
            disabled={!hydrated}
          >
            {isLightTheme ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {hydrated
                ? (isLightTheme ? homeUiCopy.themeDarkLabel : homeUiCopy.themeLightLabel)
                : homeUiCopy.themeToggleLabel}
            </span>
          </Button>
        </div>

        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-center text-sm text-destructive"
          >
            {error}
          </motion.div>
        ) : null}

        <div
          className={cn(
            "space-y-6 rounded-2xl border border-border/80 bg-card/95 p-6 shadow-card backdrop-blur-sm sm:p-7",
          )}
        >
          <section className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary">
              {t("home.createRoom")}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="home-nickname">
                {t("home.nickname")}
              </label>
              <Input
                id="home-nickname"
                placeholder={t("home.enterNickname")}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={PLAYER_NICKNAME_MAX_LENGTH}
                disabled={isLoading}
                className="h-11 border-border bg-muted/80 text-foreground placeholder:text-muted-foreground/50"
              />
              <p className="text-xs leading-relaxed text-muted-foreground/70">
                {homeUiCopy.nicknameHint}
              </p>
            </div>
            <Button
              type="button"
              className="h-12 w-full bg-gradient-fire text-lg font-semibold text-primary-foreground shadow-fire"
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
          </section>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {homeUiCopy.joinSectionLabel}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <section className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder={t("home.enterRoomCode")}
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(event.target.value.replace(/\s+/g, "").toUpperCase())
                }
                maxLength={ROOM_CODE_MAX_LENGTH}
                disabled={isLoading}
                className="h-11 min-w-0 flex-1 border-border bg-muted/80 text-center font-bold uppercase tracking-widest text-foreground placeholder:text-muted-foreground/50"
              />
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 px-5 font-semibold sm:px-6"
                onClick={handleJoin}
                disabled={joinCode.trim().length < ROOM_CODE_MIN_LENGTH || isLoading}
              >
                {t("home.join")}
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground/70">
              {homeUiCopy.joinRoomHint}
            </p>
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/50">{t("home.footer")}</p>
      </motion.div>
    </div>
  );
}
