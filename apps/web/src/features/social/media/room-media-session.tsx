"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand/react";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { MediaTokenResponse } from "@sweet-spicy/shared-types";
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteParticipant,
  type TrackPublication,
} from "livekit-client";
import { toast } from "@/hooks/use-toast";
import { refreshAccessToken, useUserStore } from "@/stores/userStore";
import { useRoomSessionStore } from "@/stores/room-session-store";

type MediaSessionStatus = "idle" | "joining" | "joined" | "reconnecting" | "disabled";
type RemoteConnectionState = RTCPeerConnectionState | "new";

interface RemoteParticipantView {
  peerId: string;
  nickname: string;
  isHost: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  stream: MediaStream | null;
  connectionState: RemoteConnectionState;
}

interface MediaSessionViewState {
  status: MediaSessionStatus;
  localStream: MediaStream | null;
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
  isUpdatingAudio: boolean;
  isUpdatingVideo: boolean;
  isUpdatingSession: boolean;
  remoteParticipants: RemoteParticipantView[];
  isJoined: boolean;
  isMediaEnabled: boolean;
}

interface RoomMediaSessionContextValue extends MediaSessionViewState {
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  leaveMedia: () => Promise<void>;
}

interface RoomMediaSessionActions {
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  leaveMedia: () => Promise<void>;
}

interface MediaPendingState {
  audio: boolean;
  video: boolean;
  session: boolean;
}

interface RequestedSessionState {
  shouldBeJoined: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

const API_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001")
    : "http://localhost:3001";
const LIVEKIT_UI_ENABLED = (process.env.NEXT_PUBLIC_LIVEKIT_ENABLED ?? "true").toLowerCase() !== "false";
const MEDIA_UNAVAILABLE_STATUS_CODES = new Set<number>([503]);

const RoomMediaSessionStoreContext = createContext<StoreApi<MediaSessionViewState> | null>(null);
const RoomMediaSessionActionsContext = createContext<RoomMediaSessionActions | null>(null);

function createMediaSessionStore() {
  const defaultStatus: MediaSessionStatus = LIVEKIT_UI_ENABLED ? "idle" : "disabled";
  return createStore<MediaSessionViewState>(() => ({
    status: defaultStatus,
    localStream: null,
    localAudioEnabled: false,
    localVideoEnabled: false,
    isUpdatingAudio: false,
    isUpdatingVideo: false,
    isUpdatingSession: false,
    remoteParticipants: [],
    isJoined: false,
    isMediaEnabled: LIVEKIT_UI_ENABLED,
  }));
}

function sortParticipantsByRoomOrder(
  participants: RemoteParticipantView[],
  roomPlayerIds: readonly string[],
): RemoteParticipantView[] {
  return [...participants].sort((left, right) => {
    const leftIndex = roomPlayerIds.indexOf(left.peerId);
    const rightIndex = roomPlayerIds.indexOf(right.peerId);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.nickname.localeCompare(right.nickname);
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }
    return leftIndex - rightIndex;
  });
}

function parseResponseMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string") {
    return message;
  }

  if (Array.isArray(message)) {
    const firstMessage = message.find((entry) => typeof entry === "string");
    if (firstMessage) {
      return firstMessage;
    }
  }

  return fallback;
}

function toDeviceErrorMessage(
  error: unknown,
  kind: "audio" | "video",
  t: (key: string, defaultValue: string) => string,
): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return kind === "audio"
          ? t("game.video.errors.microphonePermissionDenied", "Browser permission is required to use your microphone.")
          : t("game.video.errors.cameraPermissionDenied", "Browser permission is required to use your camera.");
      case "NotFoundError":
      case "DevicesNotFoundError":
        return kind === "audio"
          ? t("game.video.errors.noMicrophone", "No microphone was found.")
          : t("game.video.errors.noCamera", "No camera was found.");
      case "NotReadableError":
      case "TrackStartError":
        return kind === "audio"
          ? t("game.video.errors.microphoneBusy", "Your microphone is busy in another app.")
          : t("game.video.errors.cameraBusy", "Your camera is busy in another app.");
      default:
        return kind === "audio"
          ? t("game.video.errors.microphoneUnavailable", "Microphone is unavailable right now.")
          : t("game.video.errors.cameraUnavailable", "Camera is unavailable right now.");
    }
  }

  return kind === "audio"
    ? t("game.video.errors.microphoneUnavailable", "Microphone is unavailable right now.")
    : t("game.video.errors.cameraUnavailable", "Camera is unavailable right now.");
}

class MediaTokenRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

async function fetchMediaToken(roomCode: string, accessToken: string): Promise<MediaTokenResponse> {
  const response = await fetch(`${API_URL}/media/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ roomCode }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = parseResponseMessage(payload, "Could not start media session.");
    throw new MediaTokenRequestError(message, response.status);
  }

  return (await response.json()) as MediaTokenResponse;
}

function getPublicationEnabled(publication: TrackPublication | undefined): boolean {
  return Boolean(publication && !publication.isMuted);
}

export function RoomMediaSessionProvider({
  roomCode,
  children,
}: {
  roomCode: string;
  children: ReactNode;
}) {
  const { t } = useTranslation(["game"]);
  const translate = useCallback(
    (key: string, defaultValue: string) => t(key, { defaultValue }),
    [t],
  );
  const roomPlayers = useRoomSessionStore((state) => state.players);
  const isRoomSocketConnected = useRoomSessionStore((state) => state.isConnected);
  const mediaSessionStoreRef = useRef<StoreApi<MediaSessionViewState> | null>(null);
  if (!mediaSessionStoreRef.current) {
    mediaSessionStoreRef.current = createMediaSessionStore();
  }
  const mediaSessionStore = mediaSessionStoreRef.current;

  const roomCodeRef = useRef(roomCode);
  const roomPlayersRef = useRef(roomPlayers);
  const roomPlayerIdsRef = useRef<readonly string[]>(roomPlayers.map((player) => player.id));
  const livekitRoomRef = useRef<Room | null>(null);
  const livekitCleanupRef = useRef<(() => void) | null>(null);
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const pendingMediaRef = useRef<MediaPendingState>({
    audio: false,
    video: false,
    session: false,
  });
  const desiredSessionRef = useRef<RequestedSessionState>({
    shouldBeJoined: false,
    audioEnabled: false,
    videoEnabled: false,
  });
  const mediaAvailableRef = useRef(LIVEKIT_UI_ENABLED);

  const setViewState = useCallback(
    (
      update:
        | Partial<MediaSessionViewState>
        | ((current: MediaSessionViewState) => Partial<MediaSessionViewState>),
    ) => {
      const currentState = mediaSessionStore.getState();
      const partial = typeof update === "function" ? update(currentState) : update;
      mediaSessionStore.setState({
        ...currentState,
        ...partial,
      });
    },
    [mediaSessionStore],
  );

  const showError = useCallback(
    (message: string) => {
      toast({
        variant: "destructive",
        title: translate("game.video.title", "Video Call"),
        description: message,
      });
    },
    [translate],
  );

  const setPendingMediaFlag = useCallback(
    (kind: keyof MediaPendingState, active: boolean) => {
      pendingMediaRef.current = {
        ...pendingMediaRef.current,
        [kind]: active,
      };
      setViewState({
        isUpdatingAudio: pendingMediaRef.current.audio,
        isUpdatingVideo: pendingMediaRef.current.video,
        isUpdatingSession: pendingMediaRef.current.session,
      });
    },
    [setViewState],
  );

  const setMediaEnabled = useCallback(
    (isEnabled: boolean) => {
      mediaAvailableRef.current = isEnabled;
      setViewState((currentState) => {
        const nextStatus: MediaSessionStatus = isEnabled
          ? currentState.status === "disabled"
            ? "idle"
            : currentState.status
          : "disabled";
        return {
          isMediaEnabled: isEnabled,
          status: nextStatus,
        };
      });
    },
    [setViewState],
  );

  const getRemoteParticipantView = useCallback(
    (participant: RemoteParticipant): RemoteParticipantView => {
      const roomPlayer = roomPlayersRef.current.find((player) => player.id === participant.identity);
      const stream = remoteStreamsRef.current.get(participant.identity) ?? null;
      const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
      const videoPublication = participant.getTrackPublication(Track.Source.Camera);

      return {
        peerId: participant.identity,
        nickname: roomPlayer?.nickname ?? participant.name ?? participant.identity,
        isHost: roomPlayer?.isHost ?? false,
        audioEnabled: getPublicationEnabled(audioPublication),
        videoEnabled: getPublicationEnabled(videoPublication),
        stream,
        connectionState: "connected",
      };
    },
    [],
  );

  const updateLocalStateFromRoom = useCallback(
    (room: Room | null) => {
      if (!room) {
        setViewState({
          localStream: null,
          localAudioEnabled: false,
          localVideoEnabled: false,
        });
        return;
      }

      const audioPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      const videoPublication = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const localTracks: MediaStreamTrack[] = [];

      if (audioPublication?.track?.mediaStreamTrack) {
        localTracks.push(audioPublication.track.mediaStreamTrack);
      }
      if (videoPublication?.track?.mediaStreamTrack) {
        localTracks.push(videoPublication.track.mediaStreamTrack);
      }

      setViewState({
        localStream: localTracks.length > 0 ? new MediaStream(localTracks) : null,
        localAudioEnabled: getPublicationEnabled(audioPublication),
        localVideoEnabled: getPublicationEnabled(videoPublication),
      });
    },
    [setViewState],
  );

  const upsertRemoteParticipant = useCallback(
    (participant: RemoteParticipant) => {
      const nextParticipant = getRemoteParticipantView(participant);
      setViewState((currentState) => {
        const withoutCurrent = currentState.remoteParticipants.filter(
          (remoteParticipant) => remoteParticipant.peerId !== participant.identity,
        );
        return {
          remoteParticipants: sortParticipantsByRoomOrder(
            [...withoutCurrent, nextParticipant],
            roomPlayerIdsRef.current,
          ),
        };
      });
    },
    [getRemoteParticipantView, setViewState],
  );

  const removeRemoteParticipant = useCallback(
    (peerId: string) => {
      remoteStreamsRef.current.delete(peerId);
      setViewState((currentState) => ({
        remoteParticipants: currentState.remoteParticipants.filter(
          (participant) => participant.peerId !== peerId,
        ),
      }));
    },
    [setViewState],
  );

  const syncRemoteParticipantsFromRoom = useCallback(
    (room: Room) => {
      const nextParticipants = Array.from(room.remoteParticipants.values()).map(getRemoteParticipantView);
      setViewState({
        remoteParticipants: sortParticipantsByRoomOrder(nextParticipants, roomPlayerIdsRef.current),
      });
    },
    [getRemoteParticipantView, setViewState],
  );

  const disconnectLivekitRoom = useCallback(async () => {
    const livekitRoom = livekitRoomRef.current;
    if (!livekitRoom) {
      return;
    }

    livekitCleanupRef.current?.();
    livekitCleanupRef.current = null;
    livekitRoomRef.current = null;
    remoteStreamsRef.current.clear();

    await livekitRoom.disconnect().catch(() => undefined);
  }, []);

  const attachLivekitRoomListeners = useCallback(
    (room: Room) => {
      const handleConnectionStateChanged = (nextState: ConnectionState) => {
        if (nextState === ConnectionState.Connected) {
          setViewState({ status: "joined", isJoined: true });
          syncRemoteParticipantsFromRoom(room);
          updateLocalStateFromRoom(room);
          return;
        }

        if (
          nextState === ConnectionState.Reconnecting ||
          nextState === ConnectionState.SignalReconnecting ||
          nextState === ConnectionState.Connecting
        ) {
          setViewState((currentState) => ({
            status: "reconnecting",
            isJoined: false,
            remoteParticipants: currentState.remoteParticipants.map((participant) => ({
              ...participant,
              connectionState: "new",
            })),
          }));
          return;
        }

        if (nextState === ConnectionState.Disconnected) {
          const isDesiredJoined = desiredSessionRef.current.shouldBeJoined;
          setViewState({
            status: isDesiredJoined ? "reconnecting" : mediaAvailableRef.current ? "idle" : "disabled",
            isJoined: false,
          });
        }
      };

      const handleParticipantConnected = (participant: RemoteParticipant) => {
        upsertRemoteParticipant(participant);
      };

      const handleParticipantDisconnected = (participant: RemoteParticipant) => {
        removeRemoteParticipant(participant.identity);
      };

      const handleTrackSubscribed = (
        track: import("livekit-client").RemoteTrack,
        _publication: import("livekit-client").RemoteTrackPublication,
        participant: RemoteParticipant,
      ) => {
        const mediaTrack = track.mediaStreamTrack;
        const existingStream = remoteStreamsRef.current.get(participant.identity) ?? new MediaStream();
        const alreadyAttached = existingStream.getTracks().some((candidate) => candidate.id === mediaTrack.id);
        if (!alreadyAttached) {
          existingStream.addTrack(mediaTrack);
        }
        remoteStreamsRef.current.set(participant.identity, existingStream);
        upsertRemoteParticipant(participant);
      };

      const handleTrackUnsubscribed = (
        track: import("livekit-client").RemoteTrack,
        _publication: import("livekit-client").RemoteTrackPublication,
        participant: RemoteParticipant,
      ) => {
        const existingStream = remoteStreamsRef.current.get(participant.identity);
        if (existingStream) {
          const trackToRemove = existingStream
            .getTracks()
            .find((candidate) => candidate.id === track.mediaStreamTrack.id);
          if (trackToRemove) {
            existingStream.removeTrack(trackToRemove);
          }
        }
        upsertRemoteParticipant(participant);
      };

      const handleTrackMuted = (_publication: TrackPublication, participant: Participant) => {
        if (participant.identity === room.localParticipant.identity) {
          updateLocalStateFromRoom(room);
          return;
        }

        const remoteParticipant = room.remoteParticipants.get(participant.identity);
        if (remoteParticipant) {
          upsertRemoteParticipant(remoteParticipant);
        }
      };

      const handleTrackUnmuted = (_publication: TrackPublication, participant: Participant) => {
        if (participant.identity === room.localParticipant.identity) {
          updateLocalStateFromRoom(room);
          return;
        }

        const remoteParticipant = room.remoteParticipants.get(participant.identity);
        if (remoteParticipant) {
          upsertRemoteParticipant(remoteParticipant);
        }
      };

      const handleLocalTrackPublished = () => {
        updateLocalStateFromRoom(room);
      };

      const handleLocalTrackUnpublished = () => {
        updateLocalStateFromRoom(room);
      };

      room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
      room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.on(RoomEvent.TrackMuted, handleTrackMuted);
      room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);
      room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);

      return () => {
        room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
        room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
        room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
        room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
        room.off(RoomEvent.TrackMuted, handleTrackMuted);
        room.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);
        room.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
        room.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
      };
    },
    [removeRemoteParticipant, setViewState, syncRemoteParticipantsFromRoom, updateLocalStateFromRoom, upsertRemoteParticipant],
  );

  const requestMediaToken = useCallback(async (): Promise<MediaTokenResponse> => {
    const normalizedRoomCode = roomCodeRef.current.trim().toUpperCase();
    if (!normalizedRoomCode) {
      throw new Error(
        translate("game.video.errors.notInRoom", "Join the room before enabling voice or video."),
      );
    }

    const token = useUserStore.getState().accessToken;
    if (!token) {
      throw new MediaTokenRequestError(
        translate("game.video.errors.notAuthenticated", "Please sign in again to use voice or video."),
        401,
      );
    }

    try {
      return await fetchMediaToken(normalizedRoomCode, token);
    } catch (error) {
      if (!(error instanceof MediaTokenRequestError) || error.statusCode !== 401) {
        throw error;
      }

      const refreshedToken = await refreshAccessToken();
      return fetchMediaToken(normalizedRoomCode, refreshedToken);
    }
  }, [translate]);

  const joinMedia = useCallback(
    async (
      nextState: { audioEnabled: boolean; videoEnabled: boolean },
      {
        reconnecting = false,
      }: {
        reconnecting?: boolean;
      } = {},
    ) => {
      if (!mediaAvailableRef.current) {
        setViewState({ status: "disabled" });
        showError(
          translate(
            "game.video.errors.mediaUnavailable",
            "Voice and video are unavailable because LiveKit is not configured for this environment.",
          ),
        );
        return;
      }

      if (!isRoomSocketConnected) {
        showError(
          translate(
            "game.video.errors.socketNotReady",
            "The room connection is still starting. Try again in a moment.",
          ),
        );
        return;
      }

      setViewState({
        status: reconnecting ? "reconnecting" : "joining",
        isJoined: false,
        remoteParticipants: [],
      });
      desiredSessionRef.current = {
        shouldBeJoined: true,
        audioEnabled: nextState.audioEnabled,
        videoEnabled: nextState.videoEnabled,
      };

      try {
        const mediaToken = await requestMediaToken();
        await disconnectLivekitRoom();

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        const cleanup = attachLivekitRoomListeners(room);
        livekitCleanupRef.current = cleanup;
        livekitRoomRef.current = room;

        await room.connect(mediaToken.livekitUrl, mediaToken.token);
        syncRemoteParticipantsFromRoom(room);

        if (nextState.audioEnabled) {
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
          } catch (error) {
            desiredSessionRef.current.audioEnabled = false;
            showError(toDeviceErrorMessage(error, "audio", translate));
          }
        }

        if (nextState.videoEnabled) {
          try {
            await room.localParticipant.setCameraEnabled(true);
          } catch (error) {
            desiredSessionRef.current.videoEnabled = false;
            showError(toDeviceErrorMessage(error, "video", translate));
          }
        }

        updateLocalStateFromRoom(room);
        setViewState({
          status: "joined",
          isJoined: true,
        });
      } catch (error) {
        desiredSessionRef.current = {
          shouldBeJoined: false,
          audioEnabled: false,
          videoEnabled: false,
        };
        await disconnectLivekitRoom();

        if (error instanceof MediaTokenRequestError && MEDIA_UNAVAILABLE_STATUS_CODES.has(error.statusCode)) {
          setMediaEnabled(false);
          setViewState({
            status: "disabled",
            isJoined: false,
            localStream: null,
            localAudioEnabled: false,
            localVideoEnabled: false,
            remoteParticipants: [],
          });
          showError(
            translate(
              "game.video.errors.mediaUnavailable",
              "Voice and video are unavailable because LiveKit is not configured for this environment.",
            ),
          );
          return;
        }

        setViewState({
          status: mediaAvailableRef.current ? "idle" : "disabled",
          isJoined: false,
          localStream: null,
          localAudioEnabled: false,
          localVideoEnabled: false,
          remoteParticipants: [],
        });

        if (error instanceof MediaTokenRequestError) {
          showError(error.message);
          return;
        }

        if (error instanceof Error) {
          showError(error.message);
          return;
        }

        showError(translate("game.video.errors.deviceUnavailable", "Camera or microphone is unavailable right now."));
      }
    },
    [
      attachLivekitRoomListeners,
      disconnectLivekitRoom,
      isRoomSocketConnected,
      requestMediaToken,
      setMediaEnabled,
      setViewState,
      showError,
      syncRemoteParticipantsFromRoom,
      translate,
      updateLocalStateFromRoom,
    ],
  );

  const runMediaOperation = useCallback(
    async (
      kind: keyof MediaPendingState,
      operation: () => Promise<void>,
      blockedKinds: ReadonlyArray<keyof MediaPendingState> = [kind, "session"],
    ) => {
      if (blockedKinds.some((blockedKind) => pendingMediaRef.current[blockedKind])) {
        return;
      }

      setPendingMediaFlag(kind, true);
      try {
        await operation();
      } finally {
        setPendingMediaFlag(kind, false);
      }
    },
    [setPendingMediaFlag],
  );

  const leaveMedia = useCallback(async () => {
    await runMediaOperation(
      "session",
      async () => {
        desiredSessionRef.current = {
          shouldBeJoined: false,
          audioEnabled: false,
          videoEnabled: false,
        };
        await disconnectLivekitRoom();
        setViewState({
          status: mediaAvailableRef.current ? "idle" : "disabled",
          isJoined: false,
          localStream: null,
          localAudioEnabled: false,
          localVideoEnabled: false,
          remoteParticipants: [],
        });
      },
      ["session", "audio", "video"],
    );
  }, [disconnectLivekitRoom, runMediaOperation, setViewState]);

  const toggleAudio = useCallback(async () => {
    const needsJoin = !desiredSessionRef.current.shouldBeJoined;
    await runMediaOperation(
      needsJoin ? "session" : "audio",
      async () => {
        if (!desiredSessionRef.current.shouldBeJoined) {
          await joinMedia({ audioEnabled: true, videoEnabled: false });
          return;
        }

        const room = livekitRoomRef.current;
        if (!room) {
          await joinMedia({
            audioEnabled: true,
            videoEnabled: desiredSessionRef.current.videoEnabled,
          }, { reconnecting: true });
          return;
        }

        const nextEnabled = !desiredSessionRef.current.audioEnabled;
        try {
          await room.localParticipant.setMicrophoneEnabled(nextEnabled);
        } catch (error) {
          showError(toDeviceErrorMessage(error, "audio", translate));
          return;
        }

        desiredSessionRef.current.audioEnabled = nextEnabled;
        updateLocalStateFromRoom(room);
      },
      needsJoin ? ["session", "audio", "video"] : ["audio", "session"],
    );
  }, [joinMedia, runMediaOperation, showError, translate, updateLocalStateFromRoom]);

  const toggleVideo = useCallback(async () => {
    const needsJoin = !desiredSessionRef.current.shouldBeJoined;
    await runMediaOperation(
      needsJoin ? "session" : "video",
      async () => {
        if (!desiredSessionRef.current.shouldBeJoined) {
          await joinMedia({ audioEnabled: false, videoEnabled: true });
          return;
        }

        const room = livekitRoomRef.current;
        if (!room) {
          await joinMedia({
            audioEnabled: desiredSessionRef.current.audioEnabled,
            videoEnabled: true,
          }, { reconnecting: true });
          return;
        }

        const nextEnabled = !desiredSessionRef.current.videoEnabled;
        try {
          await room.localParticipant.setCameraEnabled(nextEnabled);
        } catch (error) {
          showError(toDeviceErrorMessage(error, "video", translate));
          return;
        }

        desiredSessionRef.current.videoEnabled = nextEnabled;
        updateLocalStateFromRoom(room);
      },
      needsJoin ? ["session", "audio", "video"] : ["video", "session"],
    );
  }, [joinMedia, runMediaOperation, showError, translate, updateLocalStateFromRoom]);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
    roomPlayersRef.current = roomPlayers;
    roomPlayerIdsRef.current = roomPlayers.map((player) => player.id);

    setViewState((currentState) => ({
      remoteParticipants: sortParticipantsByRoomOrder(
        currentState.remoteParticipants.map((participant) => {
          const roomPlayer = roomPlayers.find((player) => player.id === participant.peerId);
          if (!roomPlayer) {
            return participant;
          }

          return {
            ...participant,
            nickname: roomPlayer.nickname,
            isHost: roomPlayer.isHost ?? false,
          };
        }),
        roomPlayerIdsRef.current,
      ),
    }));
  }, [roomPlayers, setViewState]);

  useEffect(() => {
    return () => {
      desiredSessionRef.current = {
        shouldBeJoined: false,
        audioEnabled: false,
        videoEnabled: false,
      };
      void disconnectLivekitRoom();
    };
  }, [disconnectLivekitRoom]);

  const actions = useMemo<RoomMediaSessionActions>(
    () => ({
      toggleAudio,
      toggleVideo,
      leaveMedia,
    }),
    [leaveMedia, toggleAudio, toggleVideo],
  );

  return (
    <RoomMediaSessionStoreContext.Provider value={mediaSessionStore}>
      <RoomMediaSessionActionsContext.Provider value={actions}>
        {children}
      </RoomMediaSessionActionsContext.Provider>
    </RoomMediaSessionStoreContext.Provider>
  );
}

function useRoomMediaSessionStoreApi(): StoreApi<MediaSessionViewState> {
  const store = useContext(RoomMediaSessionStoreContext);
  if (!store) {
    throw new Error("useRoomMediaSession must be used within RoomMediaSessionProvider");
  }

  return store;
}

export function useRoomMediaSessionActions() {
  const actions = useContext(RoomMediaSessionActionsContext);
  if (!actions) {
    throw new Error("useRoomMediaSession must be used within RoomMediaSessionProvider");
  }

  return actions;
}

export function useRoomMediaSessionStatusState() {
  const store = useRoomMediaSessionStoreApi();
  const status = useStore(store, (state) => state.status);
  const isJoined = useStore(store, (state) => state.isJoined);
  return { status, isJoined };
}

/** When false, hide voice/video UI (`NEXT_PUBLIC_LIVEKIT_ENABLED=false` or server reported LiveKit unavailable). */
export function useRoomMediaUiVisible(): boolean {
  const store = useRoomMediaSessionStoreApi();
  return useStore(store, (state) => state.isMediaEnabled);
}

export function useRoomMediaSessionLocalState() {
  const store = useRoomMediaSessionStoreApi();
  const localStream = useStore(store, (state) => state.localStream);
  const localAudioEnabled = useStore(store, (state) => state.localAudioEnabled);
  const localVideoEnabled = useStore(store, (state) => state.localVideoEnabled);
  return { localStream, localAudioEnabled, localVideoEnabled };
}

export function useRoomMediaSessionPendingState() {
  const store = useRoomMediaSessionStoreApi();
  const isUpdatingAudio = useStore(store, (state) => state.isUpdatingAudio);
  const isUpdatingVideo = useStore(store, (state) => state.isUpdatingVideo);
  const isUpdatingSession = useStore(store, (state) => state.isUpdatingSession);
  const isMediaEnabled = useStore(store, (state) => state.isMediaEnabled);
  return { isUpdatingAudio, isUpdatingVideo, isUpdatingSession, isMediaEnabled };
}

export function useRoomMediaSessionRemoteParticipants() {
  const store = useRoomMediaSessionStoreApi();
  return useStore(store, (state) => state.remoteParticipants);
}

export function useRoomMediaSession() {
  const store = useRoomMediaSessionStoreApi();
  const state = useStore(store, (currentState) => currentState);
  const actions = useRoomMediaSessionActions();

  return useMemo<RoomMediaSessionContextValue>(
    () => ({
      ...state,
      ...actions,
    }),
    [actions, state],
  );
}
