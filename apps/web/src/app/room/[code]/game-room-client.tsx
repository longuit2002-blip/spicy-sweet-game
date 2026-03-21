"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  createInitialState,
  createLobbyPlayer,
  startGame,
  playCardLocal,
  resolveChallenge,
  acceptDeclaration,
  applyPenalty,
  nextTurn,
} from "@sweet-spicy/game-logic";
import type { GameState, Declaration, SpiceType } from "@/shared/types/game";
import { useGameStore } from "@/stores/gameStore";
import { useRoomStore } from "@/stores/roomStore";
import { useUserStore } from "@/stores/userStore";
import { PlayerHand } from "@/features/game/components/PlayerHand";
import { GameTable } from "@/features/game/components/GameTable";
import { DeclareDialog } from "@/features/game/components/DeclareDialog";
import { ChallengePhase } from "@/features/game/components/ChallengePhase";
import { RevealResult } from "@/features/game/components/RevealResult";
import { Scoreboard } from "@/features/game/components/Scoreboard";
import { OpponentBar } from "@/features/game/components/OpponentBar";
import { VideoPanel } from "@/features/video/components/VideoPanel";
import { ChatPanel } from "@/features/chat/components/ChatPanel";
import { useGameSocket } from "@/hooks/useGameSocket";
import { cn } from "@/lib/utils";

export function GameRoomClient() {
  const { t } = useTranslation(["game", "common"]);
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = params.code ?? "XXXX";
  const nick = searchParams.get("nick") ?? "Player";

  const { user } = useUserStore();
  const { players: roomPlayers, isConnected, code: roomCodeFromStore } = useRoomStore();
  const { gameState, challengeTimeLeft, decrementChallengeTimer } = useGameStore();

  const socketApi = useGameSocket();
  const createOnce = useRef(false);
  const joinOnce = useRef(false);

  const [localGameState, setLocalGameState] = useState<GameState>(() => {
    const state = createInitialState(code === "new" ? "XXXX" : code);
    const host = createLobbyPlayer(nick);
    host.isReady = true;
    host.isHost = true;
    return { ...state, players: [host] };
  });

  useEffect(() => {
    if (!user?.id || !isConnected) return;
    if (code === "new") {
      if (createOnce.current) return;
      createOnce.current = true;
      socketApi.createRoom(6, (result: unknown) => {
        const r = result as { success?: boolean; room?: { roomCode?: string } };
        if (r?.success && r?.room?.roomCode) {
          router.replace(`/room/${r.room.roomCode}`);
        }
      });
      return;
    }
    if (code && code !== "new") {
      if (joinOnce.current) return;
      joinOnce.current = true;
      socketApi.joinRoom(code);
    }
  }, [code, user?.id, isConnected, router, socketApi.createRoom, socketApi.joinRoom]);

  useEffect(() => {
    if (!isConnected || roomPlayers.length === 0) return;
    setLocalGameState((prev) => ({
      ...prev,
      phase: "LOBBY",
      roomCode: code === "new" ? prev.roomCode : code,
      players: roomPlayers.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        hand: [],
        score: p.score ?? 0,
        successfulBluffs: 0,
        successfulChallenges: 0,
        isReady: p.isReady,
        isHost: p.isHost,
      })),
    }));
  }, [isConnected, roomPlayers, code]);

  const currentGameState = gameState ?? localGameState;
  const isOnlineMode = isConnected && !!gameState;

  const [localPlayerId, setLocalPlayerId] = useState(() => "");
  useEffect(() => {
    if (user?.id) setLocalPlayerId(user.id);
  }, [user?.id]);

  const [selectedCard, setSelectedCardLocal] = useState<string | null>(null);
  const [showDeclare, setShowDeclare] = useState(false);
  const [botNames] = useState(["Blaze", "Pepper", "Zesty", "Saffron", "Cinnamon"]);

  useEffect(() => {
    if (!localPlayerId && currentGameState.players[0]?.id) {
      setLocalPlayerId(currentGameState.players[0].id);
    }
  }, [localPlayerId, currentGameState.players]);

  const currentPlayer = currentGameState.players[currentGameState.currentPlayerIndex];
  const localPlayer = currentGameState.players.find((p) => p.id === localPlayerId);
  const isMyTurn = currentPlayer?.id === localPlayerId;

  useEffect(() => {
    if (currentGameState.phase === "CHALLENGE_PHASE") {
      const timer = setInterval(() => {
        decrementChallengeTimer();
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentGameState.phase, decrementChallengeTimer]);

  useEffect(() => {
    if (isOnlineMode) return;
    if (currentGameState.phase !== "CHALLENGE_PHASE") return;
    if (challengeTimeLeft > 0) return;

    const timer = setTimeout(() => {
      handleAccept();
    }, 500);
    return () => clearTimeout(timer);
  }, [challengeTimeLeft, currentGameState.phase, isOnlineMode]);

  useEffect(() => {
    if (currentGameState.phase === "REVEAL") {
      const timer = setTimeout(() => {
        handleRevealContinue();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentGameState.phase]);

  useEffect(() => {
    if (currentGameState.phase === "PENALTY" || currentGameState.phase === "NEXT_TURN") {
      const timer = setTimeout(() => {
        handleNextTurn();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentGameState.phase]);

  useEffect(() => {
    if (isOnlineMode) return;
    if (currentGameState.phase !== "PLAYER_TURN") return;
    if (!currentPlayer) return;

    const isBotTurn = currentGameState.currentPlayerIndex !== 0;

    if (isBotTurn && currentPlayer.hand && currentPlayer.hand.length > 0) {
      const timer = setTimeout(() => {
        const hand = currentPlayer.hand || [];
        if (hand.length > 0) {
          const randomCard = hand[Math.floor(Math.random() * hand.length)];

          const types: SpiceType[] = ["chili", "pepper", "lemon"];
          const willBluff = Math.random() > 0.6;

          let declaration: Declaration;
          if (willBluff) {
            const otherTypes = types.filter((x) => x !== randomCard.type);
            declaration = {
              type: otherTypes[Math.floor(Math.random() * otherTypes.length)],
              number: randomCard.number === 1 ? 2 : 1,
            };
          } else {
            declaration = {
              type: randomCard.type,
              number: randomCard.number,
            };
          }

          setLocalGameState((prev) => playCardLocal(prev, randomCard.id, declaration));
          setSelectedCardLocal(null);
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [currentGameState.phase, currentPlayer?.id, currentGameState.currentPlayerIndex, isOnlineMode]);

  const handleRevealContinue = useCallback(() => {
    if (isOnlineMode) return;
    setLocalGameState((prev) => {
      if (prev.challengeResult) {
        return applyPenalty(prev);
      }
      return prev;
    });
  }, [isOnlineMode]);

  const handleNextTurn = useCallback(() => {
    if (isOnlineMode) return;
    setLocalGameState((prev) => nextTurn(prev));
  }, [isOnlineMode]);

  const addBot = useCallback(() => {
    if (currentGameState.players.length >= 6) return;
    const usedNames = currentGameState.players.map((p) => p.nickname);
    const available = botNames.filter((n) => !usedNames.includes(n));
    const name = available[0] ?? `Bot ${currentGameState.players.length}`;
    const bot = createLobbyPlayer(name);
    bot.isReady = true;

    setLocalGameState((prev) => ({
      ...prev,
      players: [...prev.players, bot],
    }));
  }, [currentGameState.players.length, botNames]);

  const handleStartGame = () => {
    if (isConnected && roomPlayers.length >= 2) {
      socketApi.startGame();
      return;
    }
    if (currentGameState.players.length < 2) return;
    setLocalGameState((prev) => startGame(prev));
  };

  const handleSelectCard = (cardId: string) => {
    if (!isMyTurn || currentGameState.phase !== "PLAYER_TURN") return;
    setSelectedCardLocal(cardId);
    setShowDeclare(true);
  };

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

  const handleChallenge = (challengerId: string) => {
    if (isOnlineMode) {
      socketApi.challenge();
    } else {
      setLocalGameState((prev) => {
        const revealed = resolveChallenge(prev, challengerId);
        return applyPenalty(revealed);
      });
    }
  };

  const handleAccept = () => {
    if (isOnlineMode) {
      socketApi.acceptDeclaration();
    } else {
      setLocalGameState((prev) => acceptDeclaration(prev));
    }
  };

  const displayCode = code === "new" ? "…" : code;

  const renderPhaseUI = () => {
    switch (currentGameState.phase) {
      case "LOBBY":
        return (
          <div className="flex flex-col items-center gap-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <h2 className="text-2xl font-bold mb-2">{t("game.lobby.title")}</h2>
              <p className="text-muted-foreground">
                {t("game.lobby.roomCode")}:{" "}
                <span className="font-mono text-lg font-bold">{displayCode}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">{t("game.lobby.shareCode")}</p>
            </motion.div>

            <div className="flex flex-wrap gap-3 justify-center">
              {currentGameState.players.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "px-4 py-2 rounded-full border-2",
                    player.isReady ? "bg-green-500/20 border-green-500" : "bg-muted border-muted-foreground",
                  )}
                >
                  <span className="font-semibold">{player.nickname}</span>
                  {player.isHost && <span className="ml-2 text-xs">👑</span>}
                </motion.div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={addBot}
                disabled={currentGameState.players.length >= 6 || isConnected}
              >
                {t("game.lobby.addBot")} 🤖
              </Button>
              <Button
                onClick={handleStartGame}
                disabled={
                  currentGameState.players.length < 2 || !currentGameState.players.every((p) => p.isReady)
                }
                className="bg-gradient-fire"
              >
                {t("game.lobby.startGame")} 🚀
              </Button>
            </div>
          </div>
        );

      case "PLAYER_TURN":
        return (
          <div className="text-center">
            <motion.div
              key={currentPlayer?.id}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="mb-4"
            >
              <span className="text-lg">
                {isMyTurn
                  ? t("game.turn.yourTurn")
                  : t("game.turn.waitingTurn", { player: currentPlayer?.nickname })}
              </span>
            </motion.div>
          </div>
        );

      case "CHALLENGE_PHASE":
        return (
          <ChallengePhase
            playedCard={currentGameState.playedCard}
            players={currentGameState.players}
            currentPlayerId={currentPlayer?.id}
            onChallenge={handleChallenge}
            onAccept={handleAccept}
            timerSeconds={challengeTimeLeft}
          />
        );

      case "REVEAL":
        return (
          <RevealResult
            result={currentGameState.challengeResult!}
            players={currentGameState.players}
            onContinue={handleRevealContinue}
          />
        );

      case "END_GAME":
        return (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-6"
            >
              <h2 className="text-4xl font-bold mb-2">🏆 Winner!</h2>
              <p className="text-2xl">{currentGameState.winner?.nickname}</p>
            </motion.div>

            <Scoreboard
              players={currentGameState.players}
              winner={currentGameState.winner}
              onPlayAgain={() => router.push("/")}
              onLeave={() => router.push("/")}
            />

            <Button onClick={() => router.push("/")} className="mt-6">
              Play Again 🔄
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            ← {t("room.exit")}
          </Button>
          <div>
            <h1 className="font-bold">{t("room.title")}</h1>
            <p className="text-xs text-muted-foreground">
              {t("game.lobby.roomCode")}: {displayCode} •{" "}
              {isOnlineMode ? `🟢 ${t("common.online")}` : `🟡 ${t("common.offline")}`}
            </p>
          </div>
        </div>

        <div className="flex -space-x-2">
          {currentGameState.players.slice(0, 6).map((player) => (
            <div
              key={player.id}
              className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                player.id === currentPlayer?.id ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
              title={player.nickname}
            >
              {player.nickname[0].toUpperCase()}
            </div>
          ))}
        </div>
      </header>

      <main className="flex-1 flex">
        <div className="w-64 border-r p-4 hidden lg:block">
          <OpponentBar
            players={currentGameState.players}
            currentPlayerId={currentPlayer?.id}
            activePlayerIndex={currentGameState.currentPlayerIndex}
          />
        </div>

        <div className="flex-1 flex flex-col">
          <GameTable
            playedCard={currentGameState.playedCard}
            currentPlayerName={currentPlayer?.nickname ?? ""}
          />

          <div className="flex-1 flex items-center justify-center">
            <AnimatePresence mode="wait">{renderPhaseUI()}</AnimatePresence>
          </div>

          {localPlayer && (
            <div className="p-4 border-t">
              <PlayerHand
                cards={localPlayer.hand}
                onSelectCard={handleSelectCard}
                selectedCardId={selectedCard}
                disabled={!isMyTurn || currentGameState.phase !== "PLAYER_TURN"}
              />
            </div>
          )}
        </div>

        <div className="w-80 border-l hidden xl:block">
          <ChatPanel onSendMessage={socketApi.sendChatMessage} />
        </div>
      </main>

      {isOnlineMode && (
        <VideoPanel roomCode={roomCodeFromStore ?? (code === "new" ? "" : code)} />
      )}

      <DeclareDialog
        open={showDeclare}
        onOpenChange={setShowDeclare}
        card={localPlayer?.hand.find((c) => c.id === selectedCard) ?? null}
        onDeclare={handleDeclare}
      />
    </div>
  );
}
