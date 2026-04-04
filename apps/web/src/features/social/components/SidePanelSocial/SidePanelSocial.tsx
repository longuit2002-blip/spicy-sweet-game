"use client";

import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionLog } from "@/features/game/components/ActionLog/ActionLog";
import { SocialMediaSection } from "@/features/social/media/components/SocialMediaSection";
import type { ChatMessage } from "@/shared/types/socket";
import { useChatStore } from "@/stores/chatStore";
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
  const { t } = useTranslation("game");
  const { messages: storeMessages } = useChatStore();
  const user = useUserStore((state) => state.user);
  const hasUserHydrated = useUserStore((state) => state.hasHydrated);
  const messages = messagesProp ?? storeMessages;
  const [chatInput, setChatInput] = useState("");
  const [socialTab, setSocialTab] = useState<"chat" | "log">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserId = hasUserHydrated ? user?.id ?? null : null;

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

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <SocialMediaSection />

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
              "flex h-auto w-full shrink-0 items-stretch gap-1 rounded-t-[1.25rem] rounded-b-none border border-border/25 border-b-0 bg-muted/30 p-1.5 sm:rounded-t-[2rem]",
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
              <Icon name="receipt_long" size={16} className="shrink-0" aria-hidden />
              {t("actionLog.title")}
            </TabsTrigger>
          </TabsList>

          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-[1.25rem] border border-border/25 border-t-0 bg-card/40 shadow-inner sm:rounded-b-[2rem]",
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
                      <p className="ml-2 text-ui-micro font-bold text-secondary">{msg.nickname}</p>
                    )}
                    {msg.type === "text" && msg.playerId === currentUserId && (
                      <p className="mr-2 text-right text-ui-micro font-bold text-primary">{t("game.chat.you")}</p>
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
              className={cn(
                "m-0 mt-0 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden border-0 bg-transparent p-0 shadow-none outline-none ring-0",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
              )}
            >
              <ActionLog variant="embedded" entries={actionLogEntries} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
