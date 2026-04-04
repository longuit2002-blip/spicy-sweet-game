"use client";

import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionLog } from "@/features/game/components/ActionLog/ActionLog";
import { useWebRTC } from "@/hooks/useWebRTC";
import type { ChatMessage } from "@/shared/types/socket";
import { useChatStore } from "@/stores/chatStore";
import { useRoomStore } from "@/stores/roomStore";
import { useUserStore } from "@/stores/userStore";
import { cn } from "@/lib/utils";

const SYSTEM_MESSAGE_TIMESTAMP = "1970-01-01T00:00:00.000Z";

interface SidePanelSocialProps {
  roomCode?: string;
  messages?: ChatMessage[];
  onSendMessage?: (content: string) => void;
  /** Game action log entries (tab “Nhật ký”). */
  actionLogEntries?: readonly { id: string; text: string; at: number }[];
  className?: string;
}

export function SidePanelSocial({
  roomCode = "",
  messages: messagesProp,
  onSendMessage,
  actionLogEntries = [],
  className,
}: SidePanelSocialProps) {
  const { t } = useTranslation(["game", "common"]);
  const { messages: storeMessages } = useChatStore();
  const user = useUserStore((state) => state.user);
  const hasUserHydrated = useUserStore((state) => state.hasHydrated);
  const maxPlayers = useRoomStore((state) => state.maxPlayers);
  const messages = messagesProp ?? storeMessages;
  const [chatInput, setChatInput] = useState("");
  const [socialTab, setSocialTab] = useState<"chat" | "log">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserId = hasUserHydrated ? user?.id ?? null : null;

  const {
    status,
    error,
    localStream,
    localAudioEnabled,
    localVideoEnabled,
    remoteParticipants,
    isJoined,
    clearError,
    toggleAudio,
    toggleVideo,
    leaveMedia,
  } = useWebRTC(roomCode);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendChat = () => {
    if (chatInput.trim() && onSendMessage) {
      onSendMessage(chatInput.trim());
      setChatInput("");
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const demoMessages: ChatMessage[] = messages.length > 0 ? messages : [
    {
      id: "1",
      playerId: "system",
      nickname: "System",
      content: t("game.chat.welcome"),
      type: "system",
      timestamp: SYSTEM_MESSAGE_TIMESTAMP,
    },
  ];

  const statusLabel =
    status === "joined"
      ? t("game.video.connected")
      : status === "reconnecting"
        ? t("game.video.reconnecting", { defaultValue: "Reconnecting call…" })
        : status === "joining"
          ? t("game.video.connecting", { defaultValue: "Connecting" })
          : t("game.video.idle", { defaultValue: "Idle" });
  const statusTone =
    status === "joined"
      ? "bg-emerald-500/15 text-emerald-700"
      : status === "reconnecting"
        ? "bg-amber-500/15 text-amber-700"
        : "bg-muted text-muted-foreground";
  const remoteEmptySlotCount = Math.max(0, maxPlayers - 1 - remoteParticipants.length);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon name="videocam" size={24} className="text-primary" />
            <h3 className="font-headline font-bold text-sm uppercase tracking-wider text-primary">
              {t("game.video.title")}
            </h3>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide", statusTone)}>
            {statusLabel}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {isJoined
            ? t("game.video.liveHint", {
                defaultValue: "Mic and camera are opt-in. You can stay to watch even if both are off.",
              })
            : t("game.video.idleHint", {
                defaultValue: "Enable your mic or camera when you want to join the room call.",
              })}
        </p>

        {error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <div className="flex items-start justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                className="text-[10px] font-semibold uppercase tracking-wide"
                onClick={clearError}
              >
                {t("common.dismiss", { ns: "common", defaultValue: "Dismiss" })}
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <MediaTile
            label={t("game.video.you")}
            stream={localStream}
            showVideo={localVideoEnabled}
            audioEnabled={localAudioEnabled}
            videoEnabled={localVideoEnabled}
            isLocal
          />

          {remoteParticipants.map((participant) => (
            <MediaTile
              key={participant.peerId}
              label={participant.nickname}
              stream={participant.stream}
              showVideo={participant.videoEnabled}
              audioEnabled={participant.audioEnabled}
              videoEnabled={participant.videoEnabled}
              connectionState={participant.connectionState}
            />
          ))}

          {Array.from({ length: remoteEmptySlotCount }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-outline/30 bg-surface-container-high"
            >
              <div className="flex flex-col items-center gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-outline/60">
                <Icon name="person_add" size={18} className="text-outline/50" />
                <span>{t("game.video.waiting")}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-2 pt-1">
          <Button
            variant={isJoined && localAudioEnabled ? "secondary" : "outline"}
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => {
              void toggleAudio();
            }}
            aria-label={
              localAudioEnabled
                ? t("game.video.disableAudio", { defaultValue: "Mute microphone" })
                : t("game.video.enableAudio", { defaultValue: "Enable microphone" })
            }
          >
            {localAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
          <Button
            variant={isJoined && localVideoEnabled ? "secondary" : "outline"}
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => {
              void toggleVideo();
            }}
            aria-label={
              localVideoEnabled
                ? t("game.video.disableVideo", { defaultValue: "Turn camera off" })
                : t("game.video.enableVideo", { defaultValue: "Enable camera" })
            }
          >
            {localVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => {
              void leaveMedia();
            }}
            disabled={!isJoined}
            aria-label={t("game.video.leave", { defaultValue: "Leave call" })}
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat + action log: one card, controlled tabs, body fills remaining height (no dead grey gap). */}
      <div className="mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden">
        <Tabs
          value={socialTab}
          onValueChange={(v) => {
            if (v === "chat" || v === "log") setSocialTab(v);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList
            className={cn(
              "flex h-auto w-full shrink-0 items-stretch gap-1 rounded-t-[2rem] rounded-b-none border border-border/25 border-b-0 bg-muted/30 p-1.5",
            )}
          >
            <TabsTrigger
              value="chat"
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 font-headline text-xs font-bold uppercase tracking-wide transition-colors",
                "text-muted-foreground shadow-none",
                "data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm",
                "data-[state=inactive]:hover:bg-card/50 data-[state=inactive]:hover:text-foreground/80",
              )}
            >
              <Icon name="chat_bubble" size={16} className="shrink-0" aria-hidden />
              {t("game.chat.title")}
            </TabsTrigger>
            <TabsTrigger
              value="log"
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 font-headline text-xs font-bold uppercase tracking-wide transition-colors",
                "text-muted-foreground shadow-none",
                "data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm",
                "data-[state=inactive]:hover:bg-card/50 data-[state=inactive]:hover:text-foreground/80",
              )}
            >
              {t("actionLog.title")}
            </TabsTrigger>
          </TabsList>

          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-[2rem] border border-border/25 border-t-0 bg-card/40 shadow-inner",
            )}
          >
            <TabsContent
              value="chat"
              className={cn(
                "m-0 mt-0 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden border-0 bg-transparent p-0 shadow-none outline-none ring-0",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
              )}
            >
              <div className="min-h-0 space-y-3 overflow-y-auto p-4 text-sm kawaii-scrollbar">
                {demoMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn("flex flex-col gap-1", msg.type === "text" && msg.playerId === currentUserId && "items-end")}
                  >
                    {msg.type === "text" && msg.playerId !== currentUserId && (
                      <p className="ml-2 text-[10px] font-bold text-secondary">{msg.nickname}</p>
                    )}
                    {msg.type === "text" && msg.playerId === currentUserId && (
                      <p className="mr-2 text-right text-[10px] font-bold text-primary">{t("game.chat.you")}</p>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-3 py-1.5 text-sm shadow-sm",
                        msg.type === "system" && "bg-muted/60 text-center text-xs italic",
                        msg.type === "text" && msg.playerId === currentUserId
                          ? "rounded-tr-none bg-neko-pink text-white"
                          : msg.type === "text"
                            ? "rounded-tl-none bg-surface-container-high"
                            : "bg-muted/60",
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-border/20 bg-card/50 p-3">
                <div className="relative">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder={t("game.chat.placeholder")}
                    className="h-10 rounded-full border-none bg-surface-container pr-12 placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/40"
                    disabled={!onSendMessage}
                  />
                  <Button
                    size="icon"
                    variant="kawaii"
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full"
                    onClick={handleSendChat}
                    disabled={!chatInput.trim() || !onSendMessage}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="log"
              className="m-0 mt-0 flex min-h-0 flex-1 flex-col overflow-hidden border-0 bg-transparent p-0 shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <div className="flex min-h-0 flex-1 flex-col p-3">
                <ActionLog variant="embedded" entries={actionLogEntries} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

function MediaTile({
  label,
  stream,
  showVideo,
  audioEnabled,
  videoEnabled,
  connectionState,
  isLocal = false,
}: {
  label: string;
  stream: MediaStream | null;
  showVideo: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  connectionState?: RTCPeerConnectionState | "new";
  isLocal?: boolean;
}) {
  const { t } = useTranslation("game");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative aspect-square overflow-hidden rounded-2xl border-2 border-white/70 bg-surface-container-high shadow-sm">
      {stream && showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card via-muted/60 to-muted">
          <Icon name={videoEnabled ? "person" : "videocam_off"} size={28} className="text-muted-foreground" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/45 px-2 py-1 text-[10px] text-white">
        <span className="truncate font-semibold">{label}</span>
        <div className="flex items-center gap-1">
          {audioEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
          {videoEnabled ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
        </div>
      </div>

      {!isLocal && connectionState === "new" ? (
        <div className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-white">
          {t("game.video.connecting", { defaultValue: "Connecting" })}
        </div>
      ) : null}
    </div>
  );
}
