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
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
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
  claimChallenge,
  recordChallengePass,
  tickChallengePhase,
  tickRevealPhase,
  nextTurn,
  minDeclarationRankForState,
  maxDeclarationRankForState,
  REFILL_HAND_SIZE,
  CHALLENGE_CLAIM_RACE_SECONDS,
  CHALLENGE_PICK_TYPE_SECONDS,
  PENALTY_DRAW_COUNT,
} from "@sweet-spicy/game-logic";
import type { SocketActionResult } from "@sweet-spicy/shared-types";
import type {
  ChallengeType,
  GameCard,
  GameState,
  GameViewState,
  Declaration,
  SpiceType,
  ChallengeResult,
} from "@/shared/types/game";
import { GAME_PHASE, getDrawPileCount } from "@/shared/types/game";
import { useGameStore } from "@/stores/gameStore";
import { useRoomStore } from "@/stores/roomStore";
import { useUserStore } from "@/stores/userStore";
import { PlayerHand } from "@/features/game/components/PlayerHand";
import { DeclareDialog } from "@/features/game/components/DeclareDialog";
import { CardInspectDialog } from "@/features/game/components/CardInspectDialog";
import { Scoreboard } from "@/features/game/components/Scoreboard";
import { PlayerSeat } from "@/features/game/components/PlayerSeat/PlayerSeat";
import { LobbyView } from "@/features/game/components/LobbyView";
import { RoomEntryGate } from "@/features/game/components/RoomEntryGate";
import { BoardView } from "@/features/game/components/BoardView";
import type { PenaltyFxSnapshot } from "@/features/game/components/RoundResolutionFxOverlay";
import { MobileChatFABWithMediaSession } from "@/features/game/components/RoomShell/MobileChatFAB";
import { MobileChatSheet } from "@/features/game/components/RoomShell/MobileChatSheet";
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
  OFFLINE_BOT_ACTION_DELAY_MS,
  OFFLINE_BOT_DRAW_PASS_CHANCE,
  OFFLINE_BOT_TRUTH_PLAY_THRESHOLD,
  OFFLINE_CHALLENGE_TICK_MS,
  OFFLINE_BOT_DISPLAY_NAMES,
  OFFLINE_PENALTY_PHASE_AUTO_ADVANCE_MS,
  OFFLINE_PHASE_AUTO_ADVANCE_MS,
  ROOM_NICKNAME_SEARCH_PARAM,
  isTabletopLayoutPhase,
} from "@/lib/game-room.constants";
import { SNAPPY_SPRING } from "@/features/game/animations";

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
  const roomPlayers = useRoomStore((state) => state.players);
  const isConnected = useRoomStore((state) => state.isConnected);
  const roomMaxPlayers = useRoomStore((state) => state.maxPlayers);
  const roomCode = useRoomStore((state) => state.code);
  const { gameState } = useGameStore();

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
  const [gameLog, setGameLog] = useState<readonly { id: string; text: string; at: number }[]>([]);
  const [lastActionByPlayerId, setLastActionByPlayerId] = useState<
    Readonly<Record<string, string>>
  >({});
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

  // ── Game log ─────────────────────────────────────────────────────────────

  const logSeq = useRef(0);
  const addLog = useCallback((text: string) => {
    logSeq.current += 1;
    const id = `log-${logSeq.current}`;
    setGameLog((prev) => [...prev.slice(-49), { id, text, at: Date.now() }]);
  }, []);

  const [penaltySnapshot, setPenaltySnapshot] = useState<{
    result: ChallengeResult;
    pileCardCount: number;
  } | null>(null);
  const [challengerHandBeforePenalty, setChallengerHandBeforePenalty] = useState<readonly string[] | null>(null);
  const [declarerHandBeforePenalty, setDeclarerHandBeforePenalty] = useState<readonly string[] | null>(null);
  const prevPhaseRef = useRef(currentGameState.phase);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    const cur = currentGameState.phase;
    if (prev !== cur) {
      if (cur === GAME_PHASE.CHALLENGE_PHASE && currentGameState.playedCard) {
        const pc = currentGameState.playedCard;
        const decl = currentGameState.players.find((p) => p.id === pc.playerId);
        const typeLabel = t(`spice.${pc.declaration.type}`);
        addLog(
          t("log.declared", {
            player: decl?.nickname ?? t("common.unknownPlayer", { ns: "common" }),
            type: typeLabel,
            number: pc.declaration.number,
          }),
        );
        setLastActionByPlayerId((prevActions) => ({
          ...prevActions,
          [pc.playerId]: t("seat.actionDeclared"),
        }));
      }

      if (cur === GAME_PHASE.REVEAL && currentGameState.challengeResult) {
        const r = currentGameState.challengeResult;
        const ch = currentGameState.players.find((p) => p.id === r.challengerId);
        const attrKey = r.challengeType === "suit" ? "result.suitAttr" : "result.numberAttr";
        addLog(
          t("log.challenged", {
            player: ch?.nickname ?? t("common.unknownPlayer", { ns: "common" }),
            attr: t(attrKey),
          }),
        );
        setLastActionByPlayerId((prevActions) => ({
          ...prevActions,
          [r.challengerId]: t("seat.actionChallenged"),
        }));
      }

      if (cur === GAME_PHASE.NEXT_TURN && prev === GAME_PHASE.CHALLENGE_PHASE) {
        addLog(t("log.accepted"));
      }

      if (cur === GAME_PHASE.PENALTY) {
        const snap = penaltySnapshot;
        if (snap) {
          const r = snap.result;
          const challenger = currentGameState.players.find((p) => p.id === r.challengerId);
          const declarer = currentGameState.players.find((p) => p.id === r.playerId);
          if (r.challengeCorrect) {
            addLog(
              t("log.penaltyBluffCaught", {
                challenger: challenger?.nickname ?? t("common.unknownPlayer", { ns: "common" }),
                declarer: declarer?.nickname ?? t("common.unknownPlayer", { ns: "common" }),
                count: snap.pileCardCount,
              }),
            );
          } else {
            addLog(
              t("phase.penaltyDeclarerWins", {
                declarer: declarer?.nickname ?? t("common.unknownPlayer", { ns: "common" }),
                challenger: challenger?.nickname ?? t("common.unknownPlayer", { ns: "common" }),
              }),
            );
          }
        }
      }

      if (cur === GAME_PHASE.TROPHY_AWARDED) {
        if (prev === GAME_PHASE.CHALLENGE_PHASE) {
          addLog(t("log.accepted"));
        }
        const n = currentGameState.players.length;
        if (n > 0) {
          const declarerIdx = (currentGameState.currentPlayerIndex - 1 + n) % n;
          const earner = currentGameState.players[declarerIdx];
          if (earner) {
            addLog(t("log.trophy", { player: earner.nickname }));
          }
        }
      }

      prevPhaseRef.current = cur;
    }
  }, [currentGameState, addLog, penaltySnapshot, t]);

  // ── Penalty snapshot ──────────────────────────────────────────────────────

  useEffect(() => {
    if (currentGameState.phase === GAME_PHASE.REVEAL && currentGameState.challengeResult) {
      setPenaltySnapshot({
        result: currentGameState.challengeResult,
        pileCardCount: revealPileCardCount,
      });
      const cr = currentGameState.challengeResult;
      const challenger = currentGameState.players.find((p) => p.id === cr.challengerId);
      setChallengerHandBeforePenalty(challenger ? challenger.hand.map((c) => c.id) : null);
      const declarer = currentGameState.players.find((p) => p.id === cr.playerId);
      setDeclarerHandBeforePenalty(declarer ? declarer.hand.map((c) => c.id) : null);
      return;
    }
    if (currentGameState.phase !== GAME_PHASE.PENALTY) {
      setPenaltySnapshot(null);
      setChallengerHandBeforePenalty(null);
      setDeclarerHandBeforePenalty(null);
    }
  }, [currentGameState.phase, currentGameState.challengeResult, revealPileCardCount, currentGameState.players]);

  const penaltyFxSnapshot = useMemo((): PenaltyFxSnapshot | null => {
    if (currentGameState.phase !== GAME_PHASE.PENALTY) return null;
    const snap = penaltySnapshot;
    if (!snap) return null;
    let penaltyDrawnCards: readonly GameCard[] | undefined;
    const r = snap.result;
    const diffPenaltyDraw = (prevIds: readonly string[] | null, handOwner: typeof currentGameState.players[0] | undefined) => {
      if (!handOwner || !prevIds) return undefined;
      const prefixOk = prevIds.every((id, idx) => handOwner.hand[idx]?.id === id);
      if (prefixOk && handOwner.hand.length >= prevIds.length + PENALTY_DRAW_COUNT) {
        return handOwner.hand.slice(prevIds.length, prevIds.length + PENALTY_DRAW_COUNT);
      }
      return undefined;
    };
    if (r.challengeCorrect && r.playerId === localPlayerId) {
      penaltyDrawnCards = diffPenaltyDraw(
        declarerHandBeforePenalty,
        currentGameState.players.find((p) => p.id === localPlayerId),
      );
    } else if (!r.challengeCorrect && r.challengerId === localPlayerId) {
      penaltyDrawnCards = diffPenaltyDraw(
        challengerHandBeforePenalty,
        currentGameState.players.find((p) => p.id === localPlayerId),
      );
    }
    return { result: snap.result, pileCardCount: snap.pileCardCount, penaltyDrawnCards };
  }, [challengerHandBeforePenalty, currentGameState, declarerHandBeforePenalty, localPlayerId, penaltySnapshot]);

  const trophyDeclarerPlayer = useMemo(() => {
    if (currentGameState.phase !== GAME_PHASE.TROPHY_AWARDED) return null;
    const n = currentGameState.players.length;
    if (n === 0) return null;
    const declarerIdx = (currentGameState.currentPlayerIndex - 1 + n) % n;
    return currentGameState.players[declarerIdx] ?? null;
  }, [
    currentGameState.phase,
    currentGameState.currentPlayerIndex,
    currentGameState.players,
  ]);

  // ── Phase auto-advance (offline) ──────────────────────────────────────────

  const handleNextTurn = useCallback(() => {
    if (isOnlineMode) return;
    setLocalGameState((prev) => nextTurn(prev));
  }, [isOnlineMode]);

  useEffect(() => {
    if (isOnlineMode) return;
    if (currentGameState.phase !== GAME_PHASE.CHALLENGE_PHASE) return;
    const id = setInterval(() => {
      setLocalGameState((prev) => {
        if (prev.phase !== GAME_PHASE.CHALLENGE_PHASE) return prev;
        return tickChallengePhase(prev);
      });
    }, OFFLINE_CHALLENGE_TICK_MS);
    return () => clearInterval(id);
  }, [isOnlineMode, currentGameState.phase]);

  useEffect(() => {
    if (isOnlineMode) return;
    if (currentGameState.phase !== GAME_PHASE.REVEAL) return;
    const id = setInterval(() => {
      setLocalGameState((prev) => {
        if (prev.phase !== GAME_PHASE.REVEAL) return prev;
        return tickRevealPhase(prev);
      });
    }, OFFLINE_CHALLENGE_TICK_MS);
    return () => clearInterval(id);
  }, [isOnlineMode, currentGameState.phase]);

  useEffect(() => {
    if (
      currentGameState.phase === GAME_PHASE.PENALTY ||
      currentGameState.phase === GAME_PHASE.NEXT_TURN ||
      currentGameState.phase === GAME_PHASE.TROPHY_AWARDED
    ) {
      const delay =
        currentGameState.phase === GAME_PHASE.PENALTY
          ? OFFLINE_PENALTY_PHASE_AUTO_ADVANCE_MS
          : OFFLINE_PHASE_AUTO_ADVANCE_MS;
      const timer = setTimeout(handleNextTurn, delay);
      return () => clearTimeout(timer);
    }
  }, [currentGameState.phase, handleNextTurn]);

  // ── Bot logic ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOnlineMode) return;
    if (currentGameState.phase !== GAME_PHASE.PLAYER_TURN) return;
    if (!currentPlayer) return;

    const isBotTurn = currentGameState.currentPlayerIndex !== 0;

    if (isBotTurn && currentPlayer.hand && currentPlayer.hand.length > 0) {
      const timer = setTimeout(() => {
        setLocalGameState((prev) => {
          const cp = prev.players[prev.currentPlayerIndex];
          const hand = cp?.hand || [];
          if (hand.length === 0) return prev;

          if (prev.drawPile.length > 0 && Math.random() < OFFLINE_BOT_DRAW_PASS_CHANCE) {
            return drawAndPassTurnLocal(prev, cp!.id);
          }

          const minDecl = minDeclarationRankForState(prev);
          const maxDecl = maxDeclarationRankForState(prev);
          const locked = prev.lockedSuit;

          const randomCard = hand[Math.floor(Math.random() * hand.length)];
          const allTypes: SpiceType[] = ["chili", "lemon", "avocado"];

          const pickRankInBand = () =>
            minDecl + Math.floor(Math.random() * (maxDecl - minDecl + 1));

          const suitForDecl =
            locked ?? allTypes[Math.floor(Math.random() * allTypes.length)];
          let declaration: Declaration;
          if (
            randomCard.number >= minDecl &&
            randomCard.number <= maxDecl &&
            Math.random() > OFFLINE_BOT_TRUTH_PLAY_THRESHOLD
          ) {
            declaration = { type: suitForDecl, number: randomCard.number };
          } else {
            const num = pickRankInBand();
            const typePool = locked != null ? [locked] : allTypes;
            declaration = {
              type: typePool[Math.floor(Math.random() * typePool.length)] ?? suitForDecl,
              number: num,
            };
          }
          if (locked != null) {
            declaration = { ...declaration, type: locked };
          }

          return playCardLocal(prev, randomCard.id, declaration);
        });
        setSelectedCardLocal(null);
      }, OFFLINE_BOT_ACTION_DELAY_MS);

      return () => clearTimeout(timer);
    }
  }, [
    currentGameState.phase,
    currentGameState.currentPlayerIndex,
    currentPlayer,
    isOnlineMode,
  ]);

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
      setLocalGameState((prev) => claimChallenge(prev, localPlayerId) ?? prev);
    }
  }, [handleSocketActionResult, isOnlineMode, localPlayerId, socketApi, t]);

  const handleChallengePass = useCallback(() => {
    if (isOnlineMode) {
      socketApi.challengePass((result) => {
        handleSocketActionResult(
          result,
          t("room.challengePassFailedTitle", { defaultValue: "Could not pass challenge" }),
        );
      });
    } else {
      setLocalGameState((prev) => recordChallengePass(prev, localPlayerId) ?? prev);
    }
  }, [handleSocketActionResult, isOnlineMode, localPlayerId, socketApi, t]);

  useEffect(() => {
    if (isOnlineMode) return;
    if (currentGameState.phase !== GAME_PHASE.CHALLENGE_PHASE) return;
    if (currentGameState.challengeStep !== "CLAIM_RACE") return;
    const declarerId = currentGameState.playedCard?.playerId;
    if (!declarerId || localPlayerId !== declarerId) return;
    const bot = currentGameState.players.find((p) => p.id !== declarerId);
    if (!bot) return;
    const timer = setTimeout(() => {
      setLocalGameState((prev) => claimChallenge(prev, bot.id) ?? prev);
    }, OFFLINE_BOT_ACTION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [
    isOnlineMode,
    currentGameState.phase,
    currentGameState.challengeStep,
    currentGameState.playedCard?.playerId,
    currentGameState.players,
    localPlayerId,
  ]);

  useEffect(() => {
    if (isOnlineMode) return;
    if (currentGameState.phase !== GAME_PHASE.CHALLENGE_PHASE) return;
    if (currentGameState.challengeStep !== "PICK_TYPE") return;
    const holder = currentGameState.challengeClaimHolderId;
    if (!holder || holder === localPlayerId) return;
    const timer = setTimeout(() => {
      setLocalGameState((prev) => {
        const h = prev.challengeClaimHolderId;
        if (!h) return prev;
        const type: ChallengeType = Math.random() > 0.5 ? "suit" : "number";
        return resolveChallenge(prev, h, type);
      });
    }, OFFLINE_BOT_ACTION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [
    isOnlineMode,
    currentGameState.phase,
    currentGameState.challengeStep,
    currentGameState.challengeClaimHolderId,
    localPlayerId,
  ]);

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderPhaseUI() {
    switch (currentGameState.phase) {
      case GAME_PHASE.REVEAL:
        /** Outcome is shown on the playfield via {@link PlayfieldDeclaredCardFlip} (real card); server/offline timers advance phase. */
        return null;

      case GAME_PHASE.PENALTY:
        /* Full-screen overlay + card flights: `PenaltyResultImpactOverlay` / `RoundResolutionFxOverlay` in BoardView. */
        return null;

      case GAME_PHASE.NEXT_TURN:
        /* Full-screen stinger: `NextTurnImpactOverlay` in BoardView. */
        return null;

      case GAME_PHASE.TROPHY_AWARDED:
        return (
          <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-2 px-2 text-center sm:gap-3 sm:px-4">
            <motion.div
              initial={{ scale: 0.6, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={SNAPPY_SPRING}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-trophy-gold/45 bg-trophy-gold/15 shadow-trophy-glow-soft sm:h-16 sm:w-16"
            >
              <Trophy
                className="h-9 w-9 text-trophy-gold"
                strokeWidth={1.75}
                aria-hidden
              />
            </motion.div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">{t("phase.trophyTitle")}</p>
              {trophyDeclarerPlayer ? (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t("phase.trophyBody", {
                    player: trophyDeclarerPlayer.nickname,
                    remaining: currentGameState.trophiesRemaining,
                  })}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm leading-relaxed">{t("phase.trophyAwarded")}</p>
              )}
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t("phase.trophyRefill", { count: REFILL_HAND_SIZE })}
              </p>
            </div>
          </div>
        );

      case GAME_PHASE.END_GAME:
        return (
          <div className="text-center px-4">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-6"
            >
              <h2 className="text-4xl font-bold mb-2">{t("game.winner.endHeroTitle")}</h2>
              <p className="text-2xl">
                {currentGameState.winners.length > 1
                  ? currentGameState.winners.map((p) => p.nickname).join(", ")
                  : currentGameState.winner?.nickname}
              </p>
            </motion.div>

            <Scoreboard
              players={currentGameState.players}
              winner={currentGameState.winner}
              winners={currentGameState.winners}
              onPlayAgain={leaveRoomAndNavigateHome}
              onLeave={leaveRoomAndNavigateHome}
            />

            <Button
              variant="kawaii"
              className="cartoon-button-shadow mt-6 rounded-full px-10"
              onClick={leaveRoomAndNavigateHome}
            >
              {t("game.winner.playAgain")}
            </Button>
          </div>
        );

      default:
        return null;
    }
  }

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
                    phaseContent={renderPhaseUI()}
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
                  {renderPhaseUI()}
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

