"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useLayoutEffect,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  createInitialState,
  createLobbyPlayer,
  startGame,
  playCardLocal,
  drawAndPassTurnLocal,
  resolveChallenge,
  minDeclarationRankForState,
  maxDeclarationRankForState,
  CHALLENGE_CLAIM_RACE_SECONDS,
  CHALLENGE_PICK_TYPE_SECONDS,
} from "@sweet-spicy/game-logic";
import type { SocketActionResult } from "@sweet-spicy/shared-types";
import type {
  ChallengeType,
  GameCard,
  GameState,
  GameViewState,
  Declaration,
} from "@/shared/types/game";
import { GAME_PHASE, getDrawPileCount } from "@/shared/types/game";
import { useRoomSessionStore } from "@/stores/room-session-store";
import { useUserStore } from "@/stores/userStore";
import { PlayerHand } from "@/features/game/components/PlayerHand";
import { DeclareDialog } from "@/features/game/components/DeclareDialog";
import { CardInspectDialog } from "@/features/game/components/CardInspectDialog";
import { GameRoomPhaseContent } from "@/features/game/components/GameRoomPhaseContent";
import { PlayerSeat } from "@/features/game/components/PlayerSeat/PlayerSeat";
import { LobbyView } from "@/features/game/components/LobbyView";
import { RoomEntryGate } from "@/features/game/components/RoomEntryGate";
import { BoardView } from "@/features/game/components/BoardView";
import { MobileChatFABWithMediaSession } from "@/features/game/components/RoomShell/MobileChatFAB";
import { MobileChatSheet } from "@/features/game/components/RoomShell/MobileChatSheet";
import { useGameRoomActionLog } from "@/features/game/hooks/use-game-room-action-log";
import { useOfflineGameplayLoop } from "@/features/game/hooks/use-offline-gameplay-loop";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  ROOM_ENTRY_STATUS,
  useRoomEntryController,
} from "@/hooks/use-room-entry-controller";
import { SidePanelSocial } from "@/features/social";
import { RoomMediaSessionProvider } from "@/features/social/media/room-media-session";
import { useGameSocket } from "@/hooks/useGameSocket";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ROOM_MAX_PLAYERS,
  GAME_PLAYER_HAND_ANCHOR_ID,
  GAME_PLAYER_WON_PILE_ANCHOR_ID,
  LOBBY_PLACEHOLDER_ROOM_CODE,
  MIN_PLAYERS_TO_START,
  NEW_ROOM_ROUTE_SEGMENT,
  OFFLINE_BOT_DISPLAY_NAMES,
  ROOM_NICKNAME_SEARCH_PARAM,
  isTabletopLayoutPhase,
} from "@/lib/game-room.constants";

// ── Helpers ──────────────────────────────────────────────────────────────────

// ── Main component ───────────────────────────────────────────────────────────

export function GameRoomClient() {
  const { t } = useTranslation(["game", "common"]);
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = params.code ?? LOBBY_PLACEHOLDER_ROOM_CODE;
  const isCreateRoute = code === NEW_ROOM_ROUTE_SEGMENT;
  const prefilledNickname = searchParams.get(ROOM_NICKNAME_SEARCH_PARAM)?.trim() ?? "";

  const user = useUserStore((state) => state.user);
  const hasUserHydrated = useUserStore((state) => state.hasHydrated);
  const roomPlayers = useRoomSessionStore((state) => state.players);
  const isConnected = useRoomSessionStore((state) => state.isConnected);
  const roomMaxPlayers = useRoomSessionStore((state) => state.maxPlayers);
  const roomCode = useRoomSessionStore((state) => state.code);
  const gameState = useRoomSessionStore((state) => state.gameState);

  const socketApi = useGameSocket();
  const createOnce = useRef(false);
  const [localGameState, setLocalGameState] = useState<GameState>(() =>
    createInitialState(isCreateRoute ? LOBBY_PLACEHOLDER_ROOM_CODE : code),
  );
  const [localPlayerId, setLocalPlayerId] = useState(() => user?.id ?? "");
  const [selectedCard, setSelectedCardLocal] = useState<string | null>(null);
  const [showDeclare, setShowDeclare] = useState(false);
  const [inspectCard, setInspectCard] = useState<GameCard | null>(null);
  const [handDragActive, setHandDragActive] = useState(false);
  const handDragActiveRef = useRef(false);
  const [drawPileDragActive, setDrawPileDragActive] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isAddingLobbyBot, setIsAddingLobbyBot] = useState(false);
  const [botNames] = useState<string[]>(() => [...OFFLINE_BOT_DISPLAY_NAMES]);
  const [createError, setCreateError] = useState("");

  const roomEntry = useRoomEntryController({
    enabled: !isCreateRoute,
    roomCode: code,
    initialNickname: prefilledNickname || user?.nickname || "",
    user,
    hasUserHydrated,
    isConnected,
    joinRoom: socketApi.joinRoom,
  });

  // ── Derived state (declared before any effects that use it) ─────────────────

  const currentGameState: GameViewState = gameState ?? localGameState;
  const isOnlineMode = isConnected && !!gameState;
  const currentPlayer = currentGameState.players[currentGameState.currentPlayerIndex];
  const localPlayer = currentGameState.players.find((p) => p.id === localPlayerId);
  const isMyTurn = currentPlayer?.id === localPlayerId;
  const isMobileCompact = useMediaQuery("(max-width: 767px)");
  const tablePileCount = useMemo(
    () =>
      "tablePileCount" in currentGameState
        ? currentGameState.tablePileCount
        : currentGameState.tablePile.length,
    [currentGameState],
  );
  const drawPileCount = useMemo(
    () => getDrawPileCount(currentGameState),
    [currentGameState],
  );
  const revealPileCardCount = tablePileCount + 1;
  const displayCode = code === NEW_ROOM_ROUTE_SEGMENT ? "MEOW-???" : code;

  const serverLobbySynced =
    isConnected && code !== NEW_ROOM_ROUTE_SEGMENT && roomPlayers.length > 0;
  const lobbyHeadcount = serverLobbySynced ? roomPlayers.length : currentGameState.players.length;
  const canAddLobbyBot =
    (localPlayer?.isHost ?? false) &&
    lobbyHeadcount < roomMaxPlayers &&
    !isCreatingRoom &&
    !isAddingLobbyBot &&
    (!isConnected || serverLobbySynced);

  const isMainGamePhase =
    currentGameState.phase === GAME_PHASE.PLAYER_TURN ||
    currentGameState.phase === GAME_PHASE.CHALLENGE_PHASE ||
    currentGameState.phase === GAME_PHASE.REVEAL ||
    currentGameState.phase === GAME_PHASE.PENALTY ||
    currentGameState.phase === GAME_PHASE.NEXT_TURN ||
    currentGameState.phase === GAME_PHASE.TROPHY_AWARDED;
  const isJoinedRoomRoute = !isCreateRoute && roomEntry.isReadyToRenderShell;

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isConnected) setIsAddingLobbyBot(false);
  }, [isConnected]);

  useEffect(() => {
    if (!hasUserHydrated || user?.id || !isCreateRoute) return;
    router.replace("/");
  }, [hasUserHydrated, isCreateRoute, router, user?.id]);

  useLayoutEffect(() => {
    if (isCreateRoute || !roomCode || roomCode === code) return;
    socketApi.resetClientState();
  }, [code, isCreateRoute, roomCode, socketApi]);

  useEffect(() => {
    if (!user?.id || !isConnected || !isCreateRoute || createError) return;
    if (createOnce.current) return;

    createOnce.current = true;
    setCreateError("");
    setIsCreatingRoom(true);

    socketApi.createRoom(DEFAULT_ROOM_MAX_PLAYERS, (result) => {
      setIsCreatingRoom(false);
      if (result.success) {
        router.replace(`/room/${result.room.roomCode}`);
        return;
      }

      createOnce.current = false;
      setCreateError(result.message);
      toast({
        variant: "destructive",
        title: t("room.joinFailedTitle"),
        description: result.message,
      });
    });
  }, [createError, isConnected, isCreateRoute, router, socketApi, t, user?.id]);

  useEffect(() => {
    if (!isConnected || roomPlayers.length === 0) return;
    setLocalGameState((prev) => ({
      ...prev,
      phase: GAME_PHASE.LOBBY,
      roomCode: code === NEW_ROOM_ROUTE_SEGMENT ? prev.roomCode : code,
      players: roomPlayers.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        hand: [],
        wonPile: [],
        trophyCount: p.trophyCount ?? 0,
        isReady: p.isReady,
        isHost: p.isHost,
        ...(p.isBot ? { isBot: true as const } : {}),
      })),
    }));
  }, [isConnected, roomPlayers, code]);

  useEffect(() => {
    if (!user?.id || isConnected) return;
    setLocalGameState((prev) => {
      if (prev.phase !== GAME_PHASE.LOBBY || prev.players.length === 0) return prev;
      const first = prev.players[0];
      if (first.id === user.id) return prev;
      return {
        ...prev,
        players: prev.players.map((p, i) => (i === 0 ? { ...p, id: user.id } : p)),
      };
    });
  }, [user?.id, isConnected]);

  useEffect(() => {
    if (user?.id) setLocalPlayerId(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!localPlayerId && currentGameState.players[0]?.id) {
      setLocalPlayerId(currentGameState.players[0].id);
    }
  }, [localPlayerId, currentGameState.players]);

  useEffect(() => {
    document.documentElement.setAttribute("data-room-ui", "kawaii");
    return () => document.documentElement.removeAttribute("data-room-ui");
  }, []);

  const {
    gameLog,
    lastActionByPlayerId,
    penaltyFxSnapshot,
    trophyDeclarerPlayer,
  } = useGameRoomActionLog({
    currentGameState,
    localPlayerId,
    revealPileCardCount,
    t,
  });

  const {
    applyOfflineClaimChallenge,
    applyOfflineChallengePass,
  } = useOfflineGameplayLoop({
    currentGameState,
    currentPlayer,
    isOnlineMode,
    localPlayerId,
    setLocalGameState,
    clearSelectedCard: () => setSelectedCardLocal(null),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const addBot = useCallback(() => {
    if (lobbyHeadcount >= roomMaxPlayers) return;
    if (!(localPlayer?.isHost ?? false)) return;

    if (serverLobbySynced) {
      if (isAddingLobbyBot) return;
      setIsAddingLobbyBot(true);
      socketApi.addLobbyBot((result) => {
        setIsAddingLobbyBot(false);
        if (!result.success) {
          toast({
            variant: "destructive",
            title: t("room.addBotFailedTitle"),
            description: result.message ?? t("room.addBotFailedDesc"),
          });
        }
      });
      return;
    }

    if (isConnected) return;

    const usedNames = currentGameState.players.map((p) => p.nickname);
    const available = botNames.filter((n) => !usedNames.includes(n));
    const name =
      available[0] ?? t("lobby.botFallbackName", { n: currentGameState.players.length });
    const bot = createLobbyPlayer(name, { isBot: true });
    bot.isReady = true;

    setLocalGameState((prev) => ({
      ...prev,
      players: [...prev.players, bot],
    }));
  }, [
    botNames,
    currentGameState.players,
    isConnected,
    isAddingLobbyBot,
    lobbyHeadcount,
    localPlayer?.isHost,
    roomMaxPlayers,
    serverLobbySynced,
    socketApi,
    t,
  ]);

  const handleSocketActionResult = useCallback(
    (result: SocketActionResult, title?: string): boolean => {
      if (result.success) {
        return true;
      }

      toast({
        variant: "destructive",
        title: title ?? t("room.actionFailedTitle", { defaultValue: "Action failed" }),
        description: result.message,
      });
      return false;
    },
    [t],
  );

  const handleStartGame = () => {
    if (isConnected && roomPlayers.length >= MIN_PLAYERS_TO_START) {
      socketApi.startGame((result) => {
        if (!handleSocketActionResult(result, t("lobby.startGame"))) {
          return;
        }
      });
      return;
    }
    if (currentGameState.players.length < MIN_PLAYERS_TO_START) return;
    setLocalGameState((prev) => startGame(prev));
  };

  const leaveRoomAndNavigateHome = useCallback(() => {
    if (isConnected) {
      socketApi.leaveRoom((result) => {
        if (!handleSocketActionResult(result, t("room.leaveFailedTitle", { defaultValue: "Could not leave room" }))) {
          return;
        }
        router.push("/");
      });
      return;
    }
    socketApi.resetClientState();
    router.push("/");
  }, [handleSocketActionResult, isConnected, router, socketApi, t]);

  const handleToggleReady = () => {
    if (!localPlayer) return;
    if (isConnected) {
      socketApi.setReady(!localPlayer.isReady, (result) => {
        handleSocketActionResult(
          result,
          t("room.readyFailedTitle", { defaultValue: "Could not update ready status" }),
        );
      });
    } else {
      setLocalGameState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.id === localPlayer.id ? { ...p, isReady: !p.isReady } : p,
        ),
      }));
    }
  };

  const openDeclareWithCard = useCallback(
    (cardId: string) => {
      if (!isMyTurn || currentGameState.phase !== GAME_PHASE.PLAYER_TURN) return;
      const hand = localPlayer?.hand;
      if (!hand?.some((c) => c.id === cardId)) return;
      setSelectedCardLocal(cardId);
      setShowDeclare(true);
    },
    [isMyTurn, currentGameState.phase, localPlayer?.hand],
  );

  const handleInspectCard = useCallback((card: GameCard) => {
    setInspectCard(card);
  }, []);

  const handleDeclare = (declaration: Declaration) => {
    if (!selectedCard) return;

    if (isOnlineMode) {
      socketApi.playCard(selectedCard, declaration, (result) => {
        if (
          !handleSocketActionResult(
            result,
            t("room.playFailedTitle", { defaultValue: "Could not play card" }),
          )
        ) {
          return;
        }

        setSelectedCardLocal(null);
        setShowDeclare(false);
      });
      return;
    }

    setLocalGameState((prev) => playCardLocal(prev, selectedCard, declaration));
    setSelectedCardLocal(null);
    setShowDeclare(false);
  };

  const handleDrawPass = useCallback(() => {
    if (!isMyTurn || currentGameState.phase !== GAME_PHASE.PLAYER_TURN) return;
    setSelectedCardLocal(null);
    setShowDeclare(false);
    if (isOnlineMode) {
      socketApi.drawPass((result) => {
        handleSocketActionResult(
          result,
          t("room.drawFailedTitle", { defaultValue: "Could not draw and pass" }),
        );
      });
    } else {
      setLocalGameState((prev) => drawAndPassTurnLocal(prev, localPlayerId));
    }
  }, [currentGameState.phase, handleSocketActionResult, isMyTurn, isOnlineMode, localPlayerId, socketApi, t]);

  const handleChallenge = useCallback(
    (challengerId: string, challengeType: ChallengeType) => {
      if (isOnlineMode) {
        socketApi.challenge(challengeType, (result) => {
          handleSocketActionResult(
            result,
            t("room.challengeFailedTitle", { defaultValue: "Could not resolve challenge" }),
          );
        });
      } else {
        setLocalGameState((prev) => resolveChallenge(prev, challengerId, challengeType));
      }
    },
    [handleSocketActionResult, isOnlineMode, socketApi, t],
  );

  const handleClaimChallenge = useCallback(() => {
    if (isOnlineMode) {
      socketApi.claimChallenge((result) => {
        handleSocketActionResult(
          result,
          t("room.challengeClaimFailedTitle", { defaultValue: "Could not claim challenge" }),
        );
      });
    } else {
      applyOfflineClaimChallenge();
    }
  }, [applyOfflineClaimChallenge, handleSocketActionResult, isOnlineMode, socketApi, t]);

  const handleChallengePass = useCallback(() => {
    if (isOnlineMode) {
      socketApi.challengePass((result) => {
        handleSocketActionResult(
          result,
          t("room.challengePassFailedTitle", { defaultValue: "Could not pass challenge" }),
        );
      });
    } else {
      applyOfflineChallengePass();
    }
  }, [applyOfflineChallengePass, handleSocketActionResult, isOnlineMode, socketApi, t]);
  const phaseContent = (
    <GameRoomPhaseContent
      currentGameState={currentGameState}
      trophyDeclarerPlayer={trophyDeclarerPlayer}
      t={t}
      onLeaveRoom={leaveRoomAndNavigateHome}
    />
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (!hasUserHydrated) {
    return (
      <TooltipProvider delayDuration={350}>
        <div className="kawaii-room-light-scope room-shell-bg flex min-h-dvh h-dvh items-center justify-center text-foreground">
          <p className="text-sm font-medium text-muted-foreground">{t("common.loading", { ns: "common" })}</p>
        </div>
      </TooltipProvider>
    );
  }

  if (isCreateRoute) {
    return (
      <TooltipProvider delayDuration={350}>
        <div className="kawaii-room-light-scope room-shell-bg flex min-h-dvh h-dvh items-center justify-center text-foreground">
          <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-border/70 bg-card/95 px-6 py-8 text-center shadow-card backdrop-blur-sm">
            <p className="text-sm font-medium text-muted-foreground">
              {createError || t("home.creatingRoom", { ns: "common" })}
            </p>
            {createError ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateError("");
                  createOnce.current = false;
                }}
              >
                {t("common.confirm", { ns: "common" })}
              </Button>
            ) : null}
          </div>
        </div>
      </TooltipProvider>
    );
  }

  if (!isJoinedRoomRoute) {
    return (
      <TooltipProvider delayDuration={350}>
        <RoomEntryGate
          roomCode={code}
          nickname={roomEntry.nickname}
          status={roomEntry.status}
          error={
            roomEntry.error ||
            (roomEntry.status === ROOM_ENTRY_STATUS.JOIN_FAILED
              ? t("room.joinFailedDesc")
              : "")
          }
          onNicknameChange={roomEntry.setNickname}
          onSubmit={() => {
            void roomEntry.submitJoin();
          }}
        />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={350}>
      <RoomMediaSessionProvider roomCode={code === NEW_ROOM_ROUTE_SEGMENT ? "" : code}>
        <div
          className={cn(
            "kawaii-room-light-scope room-shell-bg flex h-dvh min-h-dvh flex-col text-foreground",
          )}
        >
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <main className="relative flex flex-1 flex-col overflow-hidden">
              {currentGameState.phase === GAME_PHASE.LOBBY ? (
                <LobbyView
                  players={currentGameState.players}
                  localPlayer={localPlayer}
                  displayCode={displayCode}
                  isConnected={isConnected}
                  isCreatingRoom={isCreatingRoom}
                  roomMaxPlayers={roomMaxPlayers}
                  canAddBot={canAddLobbyBot}
                  onAddBot={addBot}
                  onStartGame={handleStartGame}
                  onToggleReady={handleToggleReady}
                />
              ) : isMainGamePhase ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <BoardView
                    players={currentGameState.players}
                    localPlayerId={localPlayerId}
                    currentPlayerIndex={currentGameState.currentPlayerIndex}
                    currentPlayer={currentPlayer}
                    isMyTurn={isMyTurn}
                    playedCard={currentGameState.playedCard}
                    currentPlayerName={currentPlayer?.nickname ?? ""}
                    phase={currentGameState.phase}
                    lastResolvedDeclaration={currentGameState.lastResolvedDeclaration}
                    lockedSuit={currentGameState.lockedSuit}
                    tablePileCount={tablePileCount}
                    drawPileCount={drawPileCount}
                    supremeReserve={currentGameState.supremeReserve}
                    trophiesRemaining={currentGameState.trophiesRemaining}
                    challengeTimer={currentGameState.challengeTimer}
                    drawPassAction={
                      isMyTurn &&
                      currentGameState.phase === GAME_PHASE.PLAYER_TURN &&
                      drawPileCount > 0
                        ? { onDrawPass: handleDrawPass }
                        : null
                    }
                    handDragActiveRef={handDragActiveRef}
                    onDrawPassPileDragSession={setDrawPileDragActive}
                    onHandCardDragSessionChange={(active) => {
                      handDragActiveRef.current = active;
                      setHandDragActive(active);
                    }}
                    declareDragPreviewCards={localPlayer?.hand ?? []}
                    playDropZone={
                      isMyTurn &&
                      currentGameState.phase === GAME_PHASE.PLAYER_TURN &&
                      currentGameState.playedCard == null
                        ? {
                            highlighted: handDragActive,
                            onCardDrop: openDeclareWithCard,
                          }
                        : null
                    }
                    challengeResult={currentGameState.challengeResult}
                    penaltyFxSnapshot={penaltyFxSnapshot}
                    phaseContent={phaseContent}
                    inlineChallenge={
                      currentGameState.phase === GAME_PHASE.CHALLENGE_PHASE && currentGameState.playedCard
                        ? {
                            players: currentGameState.players,
                            localPlayerId,
                            challengeStep: currentGameState.challengeStep ?? "CLAIM_RACE",
                            challengeClaimHolderId: currentGameState.challengeClaimHolderId ?? null,
                            challengePassIds: currentGameState.challengePassIds ?? [],
                            challengeTimer: currentGameState.challengeTimer,
                            countdownTotalSeconds:
                              currentGameState.challengeStep === "PICK_TYPE"
                                ? CHALLENGE_PICK_TYPE_SECONDS
                                : CHALLENGE_CLAIM_RACE_SECONDS,
                            onClaimChallenge: handleClaimChallenge,
                            onChallenge: handleChallenge,
                            onChallengePass: handleChallengePass,
                          }
                        : null
                    }
                    tableFooter={
                      localPlayer && isTabletopLayoutPhase(currentGameState.phase) ? (
                        <div id={GAME_PLAYER_HAND_ANCHOR_ID} className="scroll-mt-24">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-5">
                            <div className="max-w-full shrink-0 sm:max-w-[min(100%,200px)] lg:max-w-[min(100%,220px)]">
                              <PlayerSeat
                                player={localPlayer}
                                isActive={isMyTurn}
                                isLocal
                                dock
                                compact={isMobileCompact}
                                wonPileAnchorId={GAME_PLAYER_WON_PILE_ANCHOR_ID}
                                lastAction={lastActionByPlayerId[localPlayerId]}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <PlayerHand
                                cards={localPlayer.hand}
                                onInspectCard={handleInspectCard}
                                selectedCardId={selectedCard}
                                disabled={
                                  !isMyTurn || currentGameState.phase !== GAME_PHASE.PLAYER_TURN
                                }
                                drawPassDrop={
                                  isMyTurn &&
                                  currentGameState.phase === GAME_PHASE.PLAYER_TURN &&
                                  drawPileCount > 0
                                    ? {
                                        active: true,
                                        pileDragActive: drawPileDragActive,
                                      }
                                    : null
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ) : null
                    }
                  />
                </div>
              ) : (
                <div className="flex flex-grow flex-col items-center justify-center px-4 py-8">
                  {phaseContent}
                </div>
              )}
            </main>

            <aside className="hidden min-h-0 w-80 shrink-0 side-panel-glass xl:flex flex-col">
              <SidePanelSocial
                onSendMessage={socketApi.sendChatMessage}
                actionLogEntries={
                  currentGameState.phase === GAME_PHASE.LOBBY ? [] : gameLog
                }
              />
            </aside>
          </div>

          <MobileChatSheet
            open={mobileChatOpen}
            onClose={() => setMobileChatOpen(false)}
            onSendMessage={socketApi.sendChatMessage}
            actionLogEntries={
              currentGameState.phase === GAME_PHASE.LOBBY ? [] : gameLog
            }
          />

          <MobileChatFABWithMediaSession
            onClick={() => setMobileChatOpen(true)}
            label={t("game.chat.title")}
          />

          <CardInspectDialog
            card={inspectCard}
            open={inspectCard != null}
            onOpenChange={(open) => {
              if (!open) setInspectCard(null);
            }}
            canChooseToPlay={
              isMyTurn && currentGameState.phase === GAME_PHASE.PLAYER_TURN
            }
            onChooseToPlay={() => {
              if (inspectCard) openDeclareWithCard(inspectCard.id);
            }}
          />

          <DeclareDialog
            open={showDeclare}
            onOpenChange={setShowDeclare}
            card={localPlayer?.hand.find((c) => c.id === selectedCard) ?? null}
            onDeclare={handleDeclare}
            lockedSuit={currentGameState.lockedSuit}
            minDeclarationNumber={minDeclarationRankForState({
              lockedSuit: currentGameState.lockedSuit,
              lastResolvedDeclaration: currentGameState.lastResolvedDeclaration,
            })}
            maxDeclarationNumber={maxDeclarationRankForState({
              lockedSuit: currentGameState.lockedSuit,
              lastResolvedDeclaration: currentGameState.lastResolvedDeclaration,
            })}
          />
        </div>
      </RoomMediaSessionProvider>
    </TooltipProvider>
  );
}
