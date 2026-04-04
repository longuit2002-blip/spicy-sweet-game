"use client";

import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ROOM_ENTRY_STATUS,
  type RoomEntryStatus,
} from "@/hooks/use-room-entry-controller";
import { PLAYER_NICKNAME_MAX_LENGTH } from "@/lib/game-room.constants";

interface RoomEntryGateProps {
  roomCode: string;
  nickname: string;
  status: RoomEntryStatus;
  error: string;
  onNicknameChange: (nickname: string) => void;
  onSubmit: () => void;
}

const ROOM_ENTRY_COPY = {
  en: {
    authenticating: "Setting up your guest session...",
    connecting: "Connecting to the game room...",
    hint: "Enter your player name to join this room.",
    joining: "Joining room...",
  },
  vi: {
    authenticating: "Đang tạo phiên khách cho bạn…",
    connecting: "Đang kết nối tới phòng…",
    hint: "Nhập tên hiển thị để vào phòng này.",
    joining: "Đang vào phòng…",
  },
} as const;

type RoomEntryCopy = {
  authenticating: string;
  connecting: string;
  hint: string;
  joining: string;
};

function getStatusText(status: RoomEntryStatus, labels: RoomEntryCopy): string {
  switch (status) {
    case ROOM_ENTRY_STATUS.AUTHENTICATING:
      return labels.authenticating;
    case ROOM_ENTRY_STATUS.CONNECTING_SOCKET:
      return labels.connecting;
    case ROOM_ENTRY_STATUS.JOINING_ROOM:
      return labels.joining;
    case ROOM_ENTRY_STATUS.CHECKING_SESSION:
    case ROOM_ENTRY_STATUS.AWAITING_NAME:
    case ROOM_ENTRY_STATUS.JOIN_FAILED:
    case ROOM_ENTRY_STATUS.JOINED:
    default:
      return "";
  }
}

export function RoomEntryGate({
  roomCode,
  nickname,
  status,
  error,
  onNicknameChange,
  onSubmit,
}: RoomEntryGateProps) {
  const { t, i18n } = useTranslation(["common", "game"]);
  const entryCopy =
    i18n.resolvedLanguage?.startsWith("vi") ? ROOM_ENTRY_COPY.vi : ROOM_ENTRY_COPY.en;
  const isBusy =
    status === ROOM_ENTRY_STATUS.CHECKING_SESSION ||
    status === ROOM_ENTRY_STATUS.AUTHENTICATING ||
    status === ROOM_ENTRY_STATUS.CONNECTING_SOCKET ||
    status === ROOM_ENTRY_STATUS.JOINING_ROOM;
  const showForm =
    status === ROOM_ENTRY_STATUS.AWAITING_NAME ||
    status === ROOM_ENTRY_STATUS.JOIN_FAILED;

  return (
    <div className="kawaii-room-light-scope room-shell-bg flex min-h-dvh items-center justify-center px-4 py-10 text-foreground">
      <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card/95 p-6 shadow-card backdrop-blur-sm sm:p-8">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
            {t("home.roomCode")} {roomCode}
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-gradient-fire">
            {t("app.title")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {showForm ? entryCopy.hint : getStatusText(status, entryCopy) || t("common.loading")}
          </p>
        </div>

        {showForm ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="room-entry-nickname">
                {t("home.nickname")}
              </label>
              <Input
                id="room-entry-nickname"
                value={nickname}
                onChange={(event) => onNicknameChange(event.target.value)}
                placeholder={t("home.enterNickname")}
                maxLength={PLAYER_NICKNAME_MAX_LENGTH}
                className="h-11 border-border bg-muted/80 text-foreground placeholder:text-muted-foreground/50"
                disabled={isBusy}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button
              type="button"
              className="h-12 w-full bg-gradient-fire text-lg font-semibold text-primary-foreground shadow-fire"
              onClick={onSubmit}
              disabled={!nickname.trim() || isBusy}
            >
              {isBusy ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  {getStatusText(status, entryCopy) || t("common.loading")}
                </span>
              ) : (
                t("home.join")
              )}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-border/60 bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {getStatusText(status, entryCopy) || t("common.loading")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
