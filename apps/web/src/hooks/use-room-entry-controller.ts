"use client";

import { useCallback, useEffect, useState } from "react";
import type { JoinResult } from "@sweet-spicy/shared-types";
import { loginAsGuest } from "@/stores/userStore";

export const ROOM_ENTRY_STATUS = {
  CHECKING_SESSION: "checking-session",
  AWAITING_NAME: "awaiting-name",
  AUTHENTICATING: "authenticating",
  CONNECTING_SOCKET: "connecting-socket",
  JOINING_ROOM: "joining-room",
  JOINED: "joined",
  JOIN_FAILED: "join-failed",
} as const;

export type RoomEntryStatus =
  (typeof ROOM_ENTRY_STATUS)[keyof typeof ROOM_ENTRY_STATUS];

interface RoomEntryUser {
  id: string;
  nickname: string;
}

interface UseRoomEntryControllerArgs {
  enabled: boolean;
  roomCode: string;
  initialNickname: string;
  user: RoomEntryUser | null;
  hasUserHydrated: boolean;
  isConnected: boolean;
  joinRoom: (roomCode: string, callback?: (result: JoinResult) => void) => void;
}

interface UseRoomEntryControllerResult {
  nickname: string;
  setNickname: (nickname: string) => void;
  status: RoomEntryStatus;
  error: string;
  isReadyToRenderShell: boolean;
  submitJoin: () => Promise<void>;
}

function getJoinErrorMessage(result: JoinResult): string {
  if (result.success) {
    return "";
  }
  return result.message;
}

export function useRoomEntryController({
  enabled,
  roomCode,
  initialNickname,
  user,
  hasUserHydrated,
  isConnected,
  joinRoom,
}: UseRoomEntryControllerArgs): UseRoomEntryControllerResult {
  const [nickname, setNickname] = useState(initialNickname);
  const [status, setStatus] = useState<RoomEntryStatus>(ROOM_ENTRY_STATUS.CHECKING_SESSION);
  const [error, setError] = useState("");

  const runJoinAttempt = useCallback(() => {
    setError("");
    setStatus(ROOM_ENTRY_STATUS.JOINING_ROOM);
    joinRoom(roomCode, (result) => {
      if (result.success) {
        setStatus(ROOM_ENTRY_STATUS.JOINED);
        return;
      }

      setError(getJoinErrorMessage(result));
      setStatus(ROOM_ENTRY_STATUS.JOIN_FAILED);
    });
  }, [joinRoom, roomCode]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!initialNickname) {
      return;
    }

    setNickname((currentNickname) => (currentNickname.trim() ? currentNickname : initialNickname));
  }, [enabled, initialNickname]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!hasUserHydrated) {
      setStatus((currentStatus) =>
        currentStatus === ROOM_ENTRY_STATUS.JOINED
          ? currentStatus
          : ROOM_ENTRY_STATUS.CHECKING_SESSION,
      );
      return;
    }

    if (!user?.id) {
      setStatus((currentStatus) =>
        currentStatus === ROOM_ENTRY_STATUS.AUTHENTICATING
          ? currentStatus
          : ROOM_ENTRY_STATUS.AWAITING_NAME,
      );
      return;
    }

    setNickname((currentNickname) =>
      currentNickname.trim() ? currentNickname : user.nickname,
    );

    if (!isConnected) {
      setStatus((currentStatus) =>
        currentStatus === ROOM_ENTRY_STATUS.JOINED
          ? currentStatus
          : ROOM_ENTRY_STATUS.CONNECTING_SOCKET,
      );
      return;
    }

    if (
      status === ROOM_ENTRY_STATUS.CHECKING_SESSION ||
      status === ROOM_ENTRY_STATUS.AUTHENTICATING ||
      status === ROOM_ENTRY_STATUS.CONNECTING_SOCKET
    ) {
      runJoinAttempt();
    }
  }, [enabled, hasUserHydrated, isConnected, runJoinAttempt, status, user]);

  const submitJoin = useCallback(async () => {
    if (!enabled) {
      return;
    }

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      return;
    }

    if (user?.id && user.nickname === trimmedNickname) {
      if (isConnected) {
        runJoinAttempt();
      } else {
        setError("");
        setStatus(ROOM_ENTRY_STATUS.CONNECTING_SOCKET);
      }
      return;
    }

    setError("");
    setStatus(ROOM_ENTRY_STATUS.AUTHENTICATING);

    try {
      await loginAsGuest(trimmedNickname);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "");
      setStatus(ROOM_ENTRY_STATUS.JOIN_FAILED);
    }
  }, [enabled, isConnected, nickname, runJoinAttempt, user]);

  return {
    nickname,
    setNickname,
    status,
    error,
    isReadyToRenderShell: status === ROOM_ENTRY_STATUS.JOINED,
    submitJoin,
  };
}
