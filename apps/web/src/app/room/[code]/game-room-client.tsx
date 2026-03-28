"use client";

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  createInitialState,
  createLobbyPlayer,
  createPlayer,
  startGame,
  playCardLocal,
  drawAndPassTurnLocal,
  resolveChallenge,
  claimChallenge,
  tickChallengePhase,
  applyPenalty,
  nextTurn,
  minDeclarationRankForState,
  maxDeclarationRankForState,
  REFILL_HAND_SIZE,
  CHALLENGE_CLAIM_RACE_SECONDS,
  CHALLENGE_PICK_TYPE_SECONDS,
  PENALTY_DRAW_COUNT,
} from "@sweet-spicy/game-logic";
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
import { PenaltyPhaseFlyingCardStack } from "@/features/game/components/PenaltyPhaseFlyingCardStack";
import { PlayerHand } from "@/features/game/components/PlayerHand";
import { DeclareDialog } from "@/features/game/components/DeclareDialog";
import { CardInspectDialog } from "@/features/game/components/CardInspectDialog";
import { Scoreboard } from "@/features/game/components/Scoreboard";
import { PlayerSeat } from "@/features/game/components/PlayerSeat/PlayerSeat";
import { LobbyView } from "@/features/game/components/LobbyView";
import { BoardView } from "@/features/game/components/BoardView";
import type { PenaltyFxSnapshot } from "@/features/game/components/RoundResolutionFxOverlay";
import { MobileChatFAB } from "@/features/game/components/RoomShell/MobileChatFAB";
import { MobileChatSheet } from "@/features/game/components/RoomShell/MobileChatSheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SidePanelSocial } from "@/features/social";
import { useGameSocket } from "@/hooks/useGameSocket";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DEFAULT_LOBBY_NICKNAME,
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
  OFFLINE_PHASE_AUTO_ADVANCE_MS,
  isTabletopLayoutPhase,
} from "@/lib/game-room.constants";
import { SNAPPY_SPRING } from "@/features/game/animations";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildOfflineHostPlayer(nickname: string) {
  if (typeof window === "undefined") {
    const host = createLobbyPlayer(nickname);
    host.isReady = true;
    host.isHost = true;
    return host;
  }
  const uid = useUserStore.getState().user?.id;
  if (uid) {
    const host = createPlayer(uid, nickname);
    host.isReady = true;
    host.isHost = true;
    return host;
  }
  const host = createLobbyPlayer(nickname);
  host.isReady = true;
  host.isHost = true;
  return host;
}

// ── Main component ───────────────────────────────────────────────────────────

export function GameRoomClient() {
  const { t } = useTranslation(["game", "common"]);
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = params.code ?? LOBBY_PLACEHOLDER_ROOM_CODE;
  const nick = searchParams.get("nick") ?? DEFAULT_LOBBY_NICKNAME;

  const { user } = useUserStore();
  const { players: roomPlayers, isConnected } = useRoomStore();
  const { gameState } = useGameStore();

  const socketApi = useGameSocket();
  const createOnce = useRef(false);
  const joinOnce = useRef(false);

  const [localGameState, setLocalGameState] = useState<GameState>(() => {
    const state = createInitialState(
      code === NEW_ROOM_ROUTE_SEGMENT ? LOBBY_PLACEHOLDER_ROOM_CODE : code,
    );
    const host = buildOfflineHostPlayer(nick);
    return { ...state, players: [host] };
  });

  const [localPlayerId, setLocalPlayerId] = useState(() => "");
  const [selectedCard, setSelectedCardLocal] = useState<string | null>(null);
  const [showDeclare, setShowDeclare] = useState(false);
  const [inspectCard, setInspectCard] = useState<GameCard | null>(null);
  const [handDragActive, setHandDragActive] = useState(false);
  const handDragActiveRef = useRef(false);
  const [drawPileDragActive, setDrawPileDragActive] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [botNames] = useState<string[]>(() => [...OFFLINE_BOT_DISPLAY_NAMES]);
  const [gameLog, setGameLog] = useState<readonly { id: string; text: string; at: number }[]>([]);
  const [lastActionByPlayerId, setLastActionByPlayerId] = useState<
    Readonly<Record<string, string>>
  >({});

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

  const isMainGamePhase =
    currentGameState.phase === GAME_PHASE.PLAYER_TURN ||
    currentGameState.phase === GAME_PHASE.CHALLENGE_PHASE ||
    currentGameState.phase === GAME_PHASE.REVEAL ||
    currentGameState.phase === GAME_PHASE.PENALTY ||
    currentGameState.phase === GAME_PHASE.NEXT_TURN ||
    currentGameState.phase === GAME_PHASE.TROPHY_AWARDED;

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id || !isConnected) return;
    if (code === NEW_ROOM_ROUTE_SEGMENT) {
      if (createOnce.current) return;
      createOnce.current = true;
      socketApi.createRoom(DEFAULT_ROOM_MAX_PLAYERS, (result: unknown) => {
        const r = result as { success?: boolean; room?: { roomCode?: string } };
        if (r?.success && r?.room?.roomCode) {
          router.replace(`/room/${r.room.roomCode}`);
        }
      });
      return;
    }
    if (code && code !== NEW_ROOM_ROUTE_SEGMENT) {
      if (joinOnce.current) return;
      joinOnce.current = true;
      socketApi.joinRoom(code, (result: unknown) => {
        const r = result as { success?: boolean; error?: string };
        if (r?.success === false) {
          joinOnce.current = false;
          toast({
            variant: "destructive",
            title: t("room.joinFailedTitle"),
            description: r.error ?? t("room.joinFailedDesc"),
          });
        }
      });
    }
  }, [code, user?.id, isConnected, router, socketApi.createRoom, socketApi.joinRoom, t]);

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
            player: decl?.nickname ?? t("common.unknownPlayer"),
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
            player: ch?.nickname ?? t("common.unknownPlayer"),
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
        const snap = penaltySnapshotRef.current;
        if (snap) {
          const r = snap.result;
          const challenger = currentGameState.players.find((p) => p.id === r.challengerId);
          const declarer = currentGameState.players.find((p) => p.id === r.playerId);
          if (r.challengeCorrect) {
            addLog(
              t("log.penaltyWin", {
                winner: challenger?.nickname ?? t("common.unknownPlayer"),
                count: snap.pileCardCount,
              }),
            );
          } else {
            addLog(
              t("phase.penaltyDeclarerWins", {
                declarer: declarer?.nickname ?? t("common.unknownPlayer"),
                challenger: challenger?.nickname ?? t("common.unknownPlayer"),
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
  }, [currentGameState, addLog, t]);

  // ── Penalty snapshot ──────────────────────────────────────────────────────

  const penaltySnapshotRef = useRef<{
    result: ChallengeResult;
    pileCardCount: number;
  } | null>(null);

  /** Challenger hand card ids at end of REVEAL — used to diff exact draw-pile cards after `applyPenalty`. */
  const challengerHandBeforePenaltyRef = useRef<readonly string[] | null>(null);

  useEffect(() => {
    if (currentGameState.phase === GAME_PHASE.REVEAL && currentGameState.challengeResult) {
      penaltySnapshotRef.current = {
        result: currentGameState.challengeResult,
        pileCardCount: revealPileCardCount,
      };
      const cid = currentGameState.challengeResult.challengerId;
      const challenger = currentGameState.players.find((p) => p.id === cid);
      challengerHandBeforePenaltyRef.current = challenger ? challenger.hand.map((c) => c.id) : null;
    }
  }, [currentGameState.phase, currentGameState.challengeResult, revealPileCardCount, currentGameState.players]);

  const penaltyFxSnapshot = useMemo((): PenaltyFxSnapshot | null => {
    if (currentGameState.phase !== GAME_PHASE.PENALTY) return null;
    const snap = penaltySnapshotRef.current;
    if (!snap) return null;
    let penaltyDrawnCards: readonly GameCard[] | undefined;
    if (!snap.result.challengeCorrect && snap.result.challengerId === localPlayerId) {
      const challenger = currentGameState.players.find((p) => p.id === localPlayerId);
      const prevIds = challengerHandBeforePenaltyRef.current;
      if (challenger && prevIds) {
        const prefixOk = prevIds.every((id, idx) => challenger.hand[idx]?.id === id);
        if (prefixOk && challenger.hand.length >= prevIds.length + PENALTY_DRAW_COUNT) {
          penaltyDrawnCards = challenger.hand.slice(prevIds.length, prevIds.length + PENALTY_DRAW_COUNT);
        }
      }
    }
    return { result: snap.result, pileCardCount: snap.pileCardCount, penaltyDrawnCards };
  }, [currentGameState.phase, currentGameState.players, localPlayerId]);

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

  const   handleRevealContinue = useCallback(() => {
    if (isOnlineMode) return;
    setLocalGameState((prev) => {
      if (prev.phase !== GAME_PHASE.REVEAL || !prev.challengeResult) return prev;
      return applyPenalty(prev);
    });
  }, [isOnlineMode]);

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
    if (currentGameState.phase === GAME_PHASE.REVEAL) {
      const timer = setTimeout(handleRevealContinue, OFFLINE_PHASE_AUTO_ADVANCE_MS);
      return () => clearTimeout(timer);
    }
  }, [currentGameState.phase, handleRevealContinue]);

  useEffect(() => {
    if (
      currentGameState.phase === GAME_PHASE.PENALTY ||
      currentGameState.phase === GAME_PHASE.NEXT_TURN ||
      currentGameState.phase === GAME_PHASE.TROPHY_AWARDED
    ) {
      const timer = setTimeout(handleNextTurn, OFFLINE_PHASE_AUTO_ADVANCE_MS);
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
    currentPlayer?.id,
    currentGameState.currentPlayerIndex,
    isOnlineMode,
  ]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const addBot = useCallback(() => {
    if (currentGameState.players.length >= DEFAULT_ROOM_MAX_PLAYERS) return;
    const usedNames = currentGameState.players.map((p) => p.nickname);
    const available = botNames.filter((n) => !usedNames.includes(n));
    const name =
      available[0] ?? t("lobby.botFallbackName", { n: currentGameState.players.length });
    const bot = createLobbyPlayer(name);
    bot.isReady = true;

    setLocalGameState((prev) => ({
      ...prev,
      players: [...prev.players, bot],
    }));
  }, [currentGameState.players.length, currentGameState.players, botNames, t]);

  const handleStartGame = () => {
    if (isConnected && roomPlayers.length >= MIN_PLAYERS_TO_START) {
      socketApi.startGame();
      return;
    }
    if (currentGameState.players.length < MIN_PLAYERS_TO_START) return;
    setLocalGameState((prev) => startGame(prev));
  };

  const handleToggleReady = () => {
    if (!localPlayer) return;
    if (isConnected) {
      socketApi.setReady(!localPlayer.isReady);
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
      socketApi.playCard(selectedCard, declaration);
    } else {
      setLocalGameState((prev) => playCardLocal(prev, selectedCard, declaration));
    }

    setSelectedCardLocal(null);
    setShowDeclare(false);
  };

  const handleDrawPass = useCallback(() => {
    if (!isMyTurn || currentGameState.phase !== GAME_PHASE.PLAYER_TURN) return;
    setSelectedCardLocal(null);
    setShowDeclare(false);
    if (isOnlineMode) {
      socketApi.drawPass();
    } else {
      setLocalGameState((prev) => drawAndPassTurnLocal(prev, localPlayerId));
    }
  }, [isMyTurn, currentGameState.phase, isOnlineMode, localPlayerId, socketApi]);

  const handleChallenge = useCallback(
    (challengerId: string, challengeType: ChallengeType) => {
      if (isOnlineMode) {
        socketApi.challenge(challengeType);
      } else {
        setLocalGameState((prev) => resolveChallenge(prev, challengerId, challengeType));
      }
    },
    [isOnlineMode, socketApi.challenge],
  );

  const handleClaimChallenge = useCallback(() => {
    if (isOnlineMode) {
      socketApi.claimChallenge();
    } else {
      setLocalGameState((prev) => claimChallenge(prev, localPlayerId) ?? prev);
    }
  }, [isOnlineMode, localPlayerId, socketApi.claimChallenge]);

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

      case GAME_PHASE.PENALTY: {
        const snap = penaltySnapshotRef.current;
        const r = snap?.result;
        const challenger = r
          ? currentGameState.players.find((p) => p.id === r.challengerId)
          : undefined;
        const declarer = r
          ? currentGameState.players.find((p) => p.id === r.playerId)
          : undefined;
        const pileN = snap?.pileCardCount ?? 0;
        return (
          <div className="mx-auto w-full max-w-md px-1.5 text-center sm:max-w-lg sm:px-2">
            {r && challenger && declarer ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={SNAPPY_SPRING}
                className={cn(
                  "flex w-full flex-col gap-2.5 rounded-md border px-3 py-2.5 shadow-sm sm:gap-3 sm:px-4 sm:py-3",
                  r.challengeCorrect
                    ? "border-destructive/35 bg-destructive/[0.07]"
                    : "border-secondary/45 bg-secondary/[0.09]",
                )}
              >
                <p className="text-[11px] font-bold uppercase leading-tight tracking-[0.12em] text-muted-foreground sm:text-xs">
                  {t("phase.penalty")}
                </p>
                {(() => {
                  const chipClass = cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-headline text-xs font-bold uppercase tracking-wide sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm",
                    r.challengeCorrect
                      ? "border-destructive/25 bg-background/60 text-foreground"
                      : "border-secondary/30 bg-background/60 text-foreground",
                  );
                  const isDeclarer = r.playerId === localPlayerId;
                  const isChallenger = r.challengerId === localPlayerId;
                  let chip: ReactNode = null;
                  if (r.challengeCorrect) {
                    if (isChallenger) {
                      chip = (
                        <span className={chipClass}>
                          <Icon name="layers" size={18} aria-hidden />
                          {t("phase.penaltyFxRoundChip", { count: pileN })}
                        </span>
                      );
                    }
                  } else if (isDeclarer) {
                    chip = (
                      <span className={chipClass}>
                        <Icon name="layers" size={18} aria-hidden />
                        {t("phase.penaltyFxRoundChip", { count: pileN })}
                      </span>
                    );
                  } else if (isChallenger) {
                    chip = (
                      <span className={chipClass}>
                        <Icon name="playing_cards" size={18} aria-hidden />
                        {t("phase.penaltyFxDrawChip", { count: PENALTY_DRAW_COUNT })}
                      </span>
                    );
                  }
                  return (
                    <div className="flex min-h-[2.875rem] w-full flex-wrap items-center justify-center gap-2 sm:min-h-[3rem]">
                      {chip}
                    </div>
                  );
                })()}
                <div className="flex items-start gap-2 text-left sm:gap-2.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/50 sm:h-10 sm:w-10">
                    {r.timedOut && !r.challengeCorrect ? (
                      <Icon name="timer_off" size={20} className="text-destructive" aria-hidden />
                    ) : r.challengeCorrect ? (
                      <Icon name="gpp_bad" size={20} className="text-destructive" fill={1} aria-hidden />
                    ) : (
                      <Icon name="verified" size={20} className="text-secondary" fill={1} aria-hidden />
                    )}
                  </span>
                  {r.challengeCorrect ? (
                    <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed text-foreground sm:text-base sm:leading-relaxed">
                      {t("phase.penaltyChallengerWins", {
                        challenger: challenger.nickname,
                        count: pileN,
                      })}
                    </p>
                  ) : (
                    <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed text-foreground sm:text-base sm:leading-relaxed">
                      {t("phase.penaltyDeclarerWins", {
                        declarer: declarer.nickname,
                        challenger: challenger.nickname,
                      })}
                    </p>
                  )}
                </div>
                <div className="border-t border-border/15 pt-2">
                  <PenaltyPhaseFlyingCardStack pileCardCount={pileN} compact />
                </div>
              </motion.div>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">{t("phase.penalty")}</p>
            )}
          </div>
        );
      }

      case GAME_PHASE.NEXT_TURN:
        return (
          <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-1 px-2 py-0.5 text-center sm:gap-1.5 sm:px-3">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">
              {t("phases.nextTurn")}
            </p>
            <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">
              {t("phase.nextTurn")}
            </p>
          </div>
        );

      case GAME_PHASE.TROPHY_AWARDED:
        return (
          <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-2 px-2 text-center sm:gap-3 sm:px-4">
            <motion.div
              initial={{ scale: 0.6, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={SNAPPY_SPRING}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[hsl(var(--trophy-gold)/0.45)] bg-[hsl(var(--trophy-gold)/0.14)] shadow-[0_0_20px_hsl(var(--trophy-glow)/0.3)] sm:h-16 sm:w-16"
            >
              <Trophy
                className="h-9 w-9 text-[hsl(var(--trophy-gold))]"
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
              <h2 className="text-4xl font-bold mb-2">{t("winner.endHeroTitle")}</h2>
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
              onPlayAgain={() => router.push("/")}
              onLeave={() => router.push("/")}
            />

            <Button
              variant="kawaii"
              className="cartoon-button-shadow mt-6 rounded-full px-10"
              onClick={() => router.push("/")}
            >
              {t("winner.playAgain")}
            </Button>
          </div>
        );

      default:
        return null;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={350}>
    <div
      className={cn(
        "kawaii-room-light-scope room-shell-bg flex min-h-screen flex-col text-foreground",
      )}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="flex-1 relative flex flex-col overflow-hidden">
          {currentGameState.phase === GAME_PHASE.LOBBY ? (
            <LobbyView
              players={currentGameState.players}
              localPlayer={localPlayer}
              displayCode={displayCode}
              isConnected={isConnected}
              onAddBot={addBot}
              onStartGame={handleStartGame}
              onToggleReady={handleToggleReady}
            />
          ) : isMainGamePhase ? (
            <>
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
                  drawPassAction={
                    isMyTurn &&
                    currentGameState.phase === GAME_PHASE.PLAYER_TURN &&
                    drawPileCount > 0
                      ? { onDrawPass: handleDrawPass }
                      : null
                  }
                  handDragActive={handDragActive}
                  handDragActiveRef={handDragActiveRef}
                  onDrawPassPileDragSession={setDrawPileDragActive}
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
                          challengeTimer: currentGameState.challengeTimer,
                          countdownTotalSeconds:
                            currentGameState.challengeStep === "PICK_TYPE"
                              ? CHALLENGE_PICK_TYPE_SECONDS
                              : CHALLENGE_CLAIM_RACE_SECONDS,
                          onClaimChallenge: handleClaimChallenge,
                          onChallenge: handleChallenge,
                        }
                      : null
                  }
                  tableFooter={
                    localPlayer && isTabletopLayoutPhase(currentGameState.phase) ? (
                      <div id={GAME_PLAYER_HAND_ANCHOR_ID} className="scroll-mt-24">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-5">
                          <div className="shrink-0 lg:max-w-[min(100%,220px)]">
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
                              onDragSessionChange={(active) => {
                                handDragActiveRef.current = active;
                                setHandDragActive(active);
                              }}
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
                                      onDrop: handleDrawPass,
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
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-grow px-4 py-8">
              {renderPhaseUI()}
            </div>
          )}
        </main>

        <aside className="hidden min-h-0 w-80 shrink-0 side-panel-glass xl:flex flex-col">
          <SidePanelSocial
            roomCode={code === NEW_ROOM_ROUTE_SEGMENT ? "" : code}
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
        roomCode={code === NEW_ROOM_ROUTE_SEGMENT ? "" : code}
        onSendMessage={socketApi.sendChatMessage}
        actionLogEntries={
          currentGameState.phase === GAME_PHASE.LOBBY ? [] : gameLog
        }
      />

      <MobileChatFAB
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
    </TooltipProvider>
  );
}
