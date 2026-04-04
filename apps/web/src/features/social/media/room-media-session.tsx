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
import type {
  MediaIncomingAnswer,
  MediaIncomingIceCandidate,
  MediaIncomingOffer,
  MediaJoinRoomResult,
  MediaParticipant,
  SocketActionResult,
  SocketErrorCode,
} from "@sweet-spicy/shared-types";
import { SOCKET_ERROR_CODE } from "@sweet-spicy/shared-types";
import { getSocket, type GameSocket } from "@/lib/socket-client";
import { toast } from "@/hooks/use-toast";
import { useRoomStore } from "@/stores/roomStore";

type MediaSessionStatus = "idle" | "joining" | "joined" | "reconnecting";

interface RemoteParticipantView extends MediaParticipant {
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState | "new";
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
}

interface RoomMediaSessionContextValue extends MediaSessionViewState {
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  leaveMedia: () => Promise<void>;
}

interface PeerRuntime {
  peerId: string;
  connection: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  pendingIceCandidates: RTCIceCandidateInit[];
}

type LocalMediaKind = "audio" | "video";

interface MediaDeviceAvailability {
  audioInput: boolean;
  videoInput: boolean;
}

interface MediaPendingState {
  audio: boolean;
  video: boolean;
  session: boolean;
}

interface RoomMediaSessionActions {
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  leaveMedia: () => Promise<void>;
}

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: "user",
};

const DEFAULT_VIEW_STATE: MediaSessionViewState = {
  status: "idle",
  localStream: null,
  localAudioEnabled: false,
  localVideoEnabled: false,
  isUpdatingAudio: false,
  isUpdatingVideo: false,
  isUpdatingSession: false,
  remoteParticipants: [],
  isJoined: false,
};

const RoomMediaSessionStoreContext = createContext<StoreApi<MediaSessionViewState> | null>(null);
const RoomMediaSessionActionsContext = createContext<RoomMediaSessionActions | null>(null);

function createMediaSessionStore() {
  return createStore<MediaSessionViewState>(() => DEFAULT_VIEW_STATE);
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

function toActionFailureMessage(
  code: SocketErrorCode,
  fallback: string,
  t: (key: string, defaultValue: string) => string,
): string {
  switch (code) {
    case SOCKET_ERROR_CODE.MEDIA_ALREADY_ACTIVE_IN_ANOTHER_TAB:
      return t(
        "game.video.errors.alreadyActiveElsewhere",
        "Voice or video is already active in another tab for this room.",
      );
    case SOCKET_ERROR_CODE.MEDIA_BOTS_NOT_SUPPORTED:
      return t("game.video.errors.botsNotSupported", "Bots cannot join voice or video.");
    case SOCKET_ERROR_CODE.NOT_IN_ROOM:
      return t("game.video.errors.notInRoom", "Join the room before enabling voice or video.");
    case SOCKET_ERROR_CODE.MEDIA_NOT_JOINED:
      return t("game.video.errors.notJoined", "Enable voice or video before sending media updates.");
    case SOCKET_ERROR_CODE.MEDIA_PEER_NOT_FOUND:
      return t("game.video.errors.peerUnavailable", "That player is no longer available for voice or video.");
    default:
      return fallback;
  }
}

function toDeviceErrorMessage(
  error: unknown,
  kind: LocalMediaKind,
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
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return t(
          "game.video.errors.unsupportedConstraints",
          "This device cannot satisfy the requested media quality.",
        );
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

function toMissingDeviceMessage(
  kind: LocalMediaKind,
  t: (key: string, defaultValue: string) => string,
): string {
  return kind === "audio"
    ? t("game.video.errors.noMicrophone", "No microphone was found.")
    : t("game.video.errors.noCamera", "No camera was found.");
}

async function emitJoinAck(
  socket: GameSocket,
  payload: { roomCode?: string; audioEnabled: boolean; videoEnabled: boolean },
): Promise<MediaJoinRoomResult> {
  return new Promise((resolve) => {
    socket.emit("webrtc:join-room", payload, resolve);
  });
}

async function emitActionAck(
  socket: GameSocket,
  event: "webrtc:leave-room" | "webrtc:update-media-state",
  payload?: { audioEnabled: boolean; videoEnabled: boolean },
): Promise<SocketActionResult> {
  return new Promise((resolve) => {
    if (payload) {
      socket.emit(event, payload, resolve);
      return;
    }

    socket.emit(event, resolve);
  });
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
  const roomPlayers = useRoomStore((state) => state.players);
  const isRoomSocketConnected = useRoomStore((state) => state.isConnected);
  const errorRef = useRef<string | null>(null);
  const mediaSessionStoreRef = useRef<StoreApi<MediaSessionViewState> | null>(null);
  if (!mediaSessionStoreRef.current) {
    mediaSessionStoreRef.current = createMediaSessionStore();
  }
  const mediaSessionStore = mediaSessionStoreRef.current;

  const roomPlayerIdsRef = useRef<readonly string[]>(roomPlayers.map((player) => player.id));
  const localStreamRef = useRef<MediaStream | null>(null);
  const selfPeerIdRef = useRef<string | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const peerConnectionsRef = useRef<Map<string, PeerRuntime>>(new Map());
  const pendingIceCandidatesByPeerRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingMediaRef = useRef<MediaPendingState>({
    audio: false,
    video: false,
    session: false,
  });
  const deviceAvailabilityRef = useRef<MediaDeviceAvailability>({
    audioInput: true,
    videoInput: true,
  });
  const desiredSessionRef = useRef({
    shouldBeJoined: false,
    audioEnabled: false,
    videoEnabled: false,
  });
  const roomCodeRef = useRef(roomCode);

  const setViewState = useCallback(
    (
      update:
        | Partial<MediaSessionViewState>
        | ((current: MediaSessionViewState) => Partial<MediaSessionViewState>),
    ) => {
      const current = mediaSessionStore.getState();
      const partial = typeof update === "function" ? update(current) : update;
      mediaSessionStore.setState({
        ...current,
        ...partial,
      });
    },
    [mediaSessionStore],
  );

  const showError = useCallback(
    (message: string) => {
      errorRef.current = message;
      toast({
        variant: "destructive",
        title: translate("game.video.title", "Video Call"),
        description: message,
      });
    },
    [translate],
  );

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
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

  const setPendingMediaFlag = useCallback((kind: keyof MediaPendingState, active: boolean) => {
    pendingMediaRef.current = {
      ...pendingMediaRef.current,
      [kind]: active,
    };
    setViewState({
      isUpdatingAudio: pendingMediaRef.current.audio,
      isUpdatingVideo: pendingMediaRef.current.video,
      isUpdatingSession: pendingMediaRef.current.session,
    });
  }, [setViewState]);

  const syncLocalStreamState = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream || stream.getTracks().length === 0) {
      setViewState({ localStream: null });
      return;
    }

    setViewState({ localStream: stream });
  }, [setViewState]);

  const refreshDeviceAvailability = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return null;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const nextAvailability: MediaDeviceAvailability = {
        audioInput: devices.some((device) => device.kind === "audioinput"),
        videoInput: devices.some((device) => device.kind === "videoinput"),
      };
      deviceAvailabilityRef.current = nextAvailability;
      return nextAvailability;
    } catch {
      return null;
    }
  }, []);

  const upsertRemoteParticipant = useCallback((participant: MediaParticipant, stream?: MediaStream | null) => {
    setViewState((currentState) => {
      const currentParticipants = currentState.remoteParticipants;
      const roomPlayer = roomPlayers.find((player) => player.id === participant.peerId);
      const existingParticipant = currentParticipants.find((item) => item.peerId === participant.peerId);
      const nextParticipant: RemoteParticipantView = {
        ...participant,
        nickname: roomPlayer?.nickname ?? participant.nickname,
        isHost: roomPlayer?.isHost ?? participant.isHost,
        stream: stream !== undefined ? stream : existingParticipant?.stream ?? null,
        connectionState: existingParticipant?.connectionState ?? "new",
      };

      const withoutParticipant = currentParticipants.filter((item) => item.peerId !== participant.peerId);
      return {
        remoteParticipants: sortParticipantsByRoomOrder(
          [...withoutParticipant, nextParticipant],
          roomPlayerIdsRef.current,
        ),
      };
    });
  }, [roomPlayers, setViewState]);

  const updateRemoteConnectionState = useCallback(
    (peerId: string, connectionState: RTCPeerConnectionState | "new") => {
      setViewState((currentState) => ({
        remoteParticipants: currentState.remoteParticipants.map((participant) =>
          participant.peerId === peerId ? { ...participant, connectionState } : participant,
        ),
      }));
    },
    [setViewState],
  );

  const removeRemoteParticipant = useCallback((peerId: string) => {
    setViewState((currentState) => ({
      remoteParticipants: currentState.remoteParticipants.filter((participant) => participant.peerId !== peerId),
    }));
  }, [setViewState]);

  const closePeerConnection = useCallback(
    (peerId: string) => {
      const runtime = peerConnectionsRef.current.get(peerId);
      if (!runtime) {
        return;
      }

      peerConnectionsRef.current.delete(peerId);
      runtime.connection.onicecandidate = null;
      runtime.connection.ontrack = null;
      runtime.connection.onnegotiationneeded = null;
      runtime.connection.onconnectionstatechange = null;
      runtime.connection.close();
      updateRemoteConnectionState(peerId, "closed");
    },
    [updateRemoteConnectionState],
  );

  const closeAllPeerConnections = useCallback(
    ({ preserveParticipants }: { preserveParticipants: boolean }) => {
      for (const peerId of peerConnectionsRef.current.keys()) {
        closePeerConnection(peerId);
      }

      if (preserveParticipants) {
        setViewState((currentState) => ({
          remoteParticipants: currentState.remoteParticipants.map((participant) => ({
            ...participant,
            stream: null,
            connectionState: "new",
          })),
        }));
        return;
      }

      setViewState({ remoteParticipants: [] });
    },
    [closePeerConnection, setViewState],
  );

  const stopLocalTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    localStreamRef.current = null;
    setViewState({
      localAudioEnabled: false,
      localVideoEnabled: false,
    });
    syncLocalStreamState();
  }, [setViewState, syncLocalStreamState]);

  const ensureLocalStreamContainer = useCallback(() => {
    if (!localStreamRef.current) {
      localStreamRef.current = new MediaStream();
    }

    return localStreamRef.current;
  }, []);

  const getLiveTrack = useCallback((kind: "audio" | "video") => {
    const stream = localStreamRef.current;
    if (!stream) {
      return null;
    }

    const tracks = kind === "audio" ? stream.getAudioTracks() : stream.getVideoTracks();
    return tracks.find((track) => track.readyState === "live") ?? null;
  }, []);

  const addTrackToPeers = useCallback((track: MediaStreamTrack) => {
    const stream = ensureLocalStreamContainer();
    for (const runtime of peerConnectionsRef.current.values()) {
      const existingSender = runtime.connection.getSenders().find((sender) => sender.track?.kind === track.kind);
      if (existingSender) {
        void existingSender.replaceTrack(track);
        continue;
      }

      runtime.connection.addTrack(track, stream);
    }
  }, [ensureLocalStreamContainer]);

  const removeTrackFromPeers = useCallback((kind: "audio" | "video") => {
    for (const runtime of peerConnectionsRef.current.values()) {
      const sender = runtime.connection.getSenders().find((candidate) => candidate.track?.kind === kind);
      if (sender) {
        runtime.connection.removeTrack(sender);
      }
    }
  }, []);

  const emitMediaStateUpdate = useCallback(async () => {
    const socket = getSocket();
    if (!socket?.connected || !desiredSessionRef.current.shouldBeJoined) {
      return;
    }

    const result = await emitActionAck(socket, "webrtc:update-media-state", {
      audioEnabled: desiredSessionRef.current.audioEnabled,
      videoEnabled: desiredSessionRef.current.videoEnabled,
    });

    if (!result.success) {
      showError(toActionFailureMessage(result.code, result.message, translate));
    }
  }, [showError, translate]);

  const handleTrackEnded = useCallback(
    async (kind: LocalMediaKind, trackId: string) => {
      const stream = localStreamRef.current;
      const track =
        kind === "audio"
          ? stream?.getAudioTracks().find((candidate) => candidate.id === trackId) ?? null
          : stream?.getVideoTracks().find((candidate) => candidate.id === trackId) ?? null;

      if (!track) {
        return;
      }

      track.onended = null;
      stream?.removeTrack(track);
      removeTrackFromPeers(kind);
      syncLocalStreamState();

      if (kind === "audio") {
        desiredSessionRef.current.audioEnabled = false;
        setViewState({ localAudioEnabled: false });
        showError(translate("game.video.errors.microphoneUnavailable", "Microphone is unavailable right now."));
      } else {
        desiredSessionRef.current.videoEnabled = false;
        setViewState({ localVideoEnabled: false });
        showError(translate("game.video.errors.cameraUnavailable", "Camera is unavailable right now."));
      }

      await emitMediaStateUpdate();
    },
    [emitMediaStateUpdate, removeTrackFromPeers, setViewState, showError, syncLocalStreamState, translate],
  );

  const acquireTrack = useCallback(
    async (kind: LocalMediaKind) => {
      const existingTrack = getLiveTrack(kind);
      if (existingTrack) {
        return existingTrack;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        showError(
          kind === "audio"
            ? translate("game.video.errors.microphoneUnavailable", "Microphone is unavailable right now.")
            : translate("game.video.errors.cameraUnavailable", "Camera is unavailable right now."),
        );
        return null;
      }

      const deviceAvailability = await refreshDeviceAvailability();
      if (deviceAvailability) {
        const hasRequestedDevice = kind === "audio" ? deviceAvailability.audioInput : deviceAvailability.videoInput;
        if (!hasRequestedDevice) {
          showError(toMissingDeviceMessage(kind, translate));
          return null;
        }
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          kind === "audio"
            ? { audio: AUDIO_CONSTRAINTS, video: false }
            : { audio: false, video: VIDEO_CONSTRAINTS },
        );
        const track =
          kind === "audio" ? stream.getAudioTracks()[0] ?? null : stream.getVideoTracks()[0] ?? null;
        if (!track) {
          showError(
            kind === "audio"
              ? translate("game.video.errors.microphoneUnavailable", "Microphone is unavailable right now.")
              : translate("game.video.errors.cameraUnavailable", "Camera is unavailable right now."),
          );
          return null;
        }

        track.onended = () => {
          void handleTrackEnded(kind, track.id);
        };
        ensureLocalStreamContainer().addTrack(track);
        syncLocalStreamState();
        return track;
      } catch (deviceError) {
        showError(toDeviceErrorMessage(deviceError, kind, translate));
        return null;
      }
    },
    [
      ensureLocalStreamContainer,
      getLiveTrack,
      handleTrackEnded,
      refreshDeviceAvailability,
      showError,
      syncLocalStreamState,
      translate,
    ],
  );

  const createPeerConnection = useCallback(
    (participant: MediaParticipant) => {
      const existingRuntime = peerConnectionsRef.current.get(participant.peerId);
      if (existingRuntime) {
        return existingRuntime;
      }

      const connection = new RTCPeerConnection({ iceServers: iceServersRef.current });
      const runtime: PeerRuntime = {
        peerId: participant.peerId,
        connection,
        polite: (selfPeerIdRef.current ?? "").localeCompare(participant.peerId) > 0,
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
        pendingIceCandidates:
          pendingIceCandidatesByPeerRef.current.get(participant.peerId)?.slice() ?? [],
      };
      pendingIceCandidatesByPeerRef.current.delete(participant.peerId);

      const localAudioTrack = getLiveTrack("audio");
      const localVideoTrack = getLiveTrack("video");
      const localStream = localStreamRef.current;

      if (localAudioTrack && localStream) {
        connection.addTrack(localAudioTrack, localStream);
      }

      if (localVideoTrack && localStream) {
        connection.addTrack(localVideoTrack, localStream);
      }

      if (!localAudioTrack && !localVideoTrack) {
        connection.addTransceiver("audio", { direction: "recvonly" });
        connection.addTransceiver("video", { direction: "recvonly" });
      }

      connection.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }

        const socket = getSocket();
        socket?.emit("webrtc:ice-candidate", {
          targetPeerId: participant.peerId,
          candidate: event.candidate.toJSON(),
        });
      };

      connection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) {
          return;
        }

        upsertRemoteParticipant(participant, remoteStream);
      };

      connection.onconnectionstatechange = () => {
        const nextState = connection.connectionState;
        updateRemoteConnectionState(participant.peerId, nextState === "closed" ? "new" : nextState);
      };

      connection.onnegotiationneeded = async () => {
        if (!desiredSessionRef.current.shouldBeJoined) {
          return;
        }

        try {
          runtime.makingOffer = true;
          await connection.setLocalDescription();

          if (!connection.localDescription) {
            return;
          }

          const socket = getSocket();
          socket?.emit("webrtc:offer", {
            targetPeerId: participant.peerId,
            offer: connection.localDescription.toJSON(),
          });
        } catch {
          // Ignore ephemeral renegotiation failures; reconnect flow rebuilds the graph if needed.
        } finally {
          runtime.makingOffer = false;
        }
      };

      peerConnectionsRef.current.set(participant.peerId, runtime);
      upsertRemoteParticipant(participant);
      updateRemoteConnectionState(participant.peerId, "new");
      return runtime;
    },
    [getLiveTrack, updateRemoteConnectionState, upsertRemoteParticipant],
  );

  const flushPendingIceCandidates = useCallback(async (runtime: PeerRuntime) => {
    if (!runtime.connection.remoteDescription) {
      return;
    }

    for (const candidate of runtime.pendingIceCandidates.splice(0)) {
      await runtime.connection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const handleIncomingOffer = useCallback(
    async ({ fromPeerId, offer }: MediaIncomingOffer) => {
      if (!desiredSessionRef.current.shouldBeJoined || fromPeerId === selfPeerIdRef.current) {
        return;
      }

      const participant =
        mediaSessionStore.getState().remoteParticipants.find((item) => item.peerId === fromPeerId) ??
        ({
          peerId: fromPeerId,
          nickname: roomPlayers.find((player) => player.id === fromPeerId)?.nickname ?? fromPeerId,
          isHost: roomPlayers.find((player) => player.id === fromPeerId)?.isHost ?? false,
          audioEnabled: true,
          videoEnabled: true,
        } satisfies MediaParticipant);
      const runtime = createPeerConnection(participant);
      const readyForOffer =
        !runtime.makingOffer &&
        (runtime.connection.signalingState === "stable" || runtime.isSettingRemoteAnswerPending);
      const offerCollision = !readyForOffer;

      runtime.ignoreOffer = !runtime.polite && offerCollision;
      if (runtime.ignoreOffer) {
        return;
      }

      runtime.isSettingRemoteAnswerPending = offer.type === "answer";
      await runtime.connection.setRemoteDescription(new RTCSessionDescription(offer));
      runtime.isSettingRemoteAnswerPending = false;
      await flushPendingIceCandidates(runtime);

      await runtime.connection.setLocalDescription();
      if (!runtime.connection.localDescription) {
        return;
      }

      const socket = getSocket();
      socket?.emit("webrtc:answer", {
        targetPeerId: fromPeerId,
        answer: runtime.connection.localDescription.toJSON(),
      });
    },
    [createPeerConnection, flushPendingIceCandidates, mediaSessionStore, roomPlayers],
  );

  const handleIncomingAnswer = useCallback(
    async ({ fromPeerId, answer }: MediaIncomingAnswer) => {
      const runtime = peerConnectionsRef.current.get(fromPeerId);
      if (!runtime) {
        return;
      }

      runtime.isSettingRemoteAnswerPending = true;
      await runtime.connection.setRemoteDescription(new RTCSessionDescription(answer));
      runtime.isSettingRemoteAnswerPending = false;
      await flushPendingIceCandidates(runtime);
    },
    [flushPendingIceCandidates],
  );

  const handleIncomingIceCandidate = useCallback(async ({ fromPeerId, candidate }: MediaIncomingIceCandidate) => {
    const runtime = peerConnectionsRef.current.get(fromPeerId);
    if (!runtime) {
      const queuedCandidates = pendingIceCandidatesByPeerRef.current.get(fromPeerId) ?? [];
      queuedCandidates.push(candidate);
      pendingIceCandidatesByPeerRef.current.set(fromPeerId, queuedCandidates);
      return;
    }

    if (!runtime.connection.remoteDescription) {
      runtime.pendingIceCandidates.push(candidate);
      return;
    }

    await runtime.connection.addIceCandidate(new RTCIceCandidate(candidate));
  }, []);

  const joinMedia = useCallback(
    async (nextState: { audioEnabled: boolean; videoEnabled: boolean }, isReconnect = false) => {
      const socket = getSocket();
      if (!socket?.connected) {
        showError(
          translate(
            "game.video.errors.socketNotReady",
            "The room connection is still starting. Try again in a moment.",
          ),
        );
        return;
      }

      if (nextState.audioEnabled) {
        const audioTrack = await acquireTrack("audio");
        if (!audioTrack) {
          stopLocalTracks();
          return;
        }
        audioTrack.enabled = true;
      }

      if (nextState.videoEnabled) {
        const videoTrack = await acquireTrack("video");
        if (!videoTrack) {
          stopLocalTracks();
          return;
        }
        videoTrack.enabled = true;
      }

      setViewState({ status: isReconnect ? "reconnecting" : "joining" });

      desiredSessionRef.current = {
        shouldBeJoined: true,
        audioEnabled: nextState.audioEnabled,
        videoEnabled: nextState.videoEnabled,
      };

      const result = await emitJoinAck(socket, {
        roomCode: roomCodeRef.current,
        audioEnabled: nextState.audioEnabled,
        videoEnabled: nextState.videoEnabled,
      });

      if (!result.success) {
        desiredSessionRef.current = {
          shouldBeJoined: false,
          audioEnabled: false,
          videoEnabled: false,
        };
        stopLocalTracks();
        closeAllPeerConnections({ preserveParticipants: false });
        setViewState({
          isJoined: false,
          status: "idle",
        });
        showError(toActionFailureMessage(result.code, result.message, translate));
        return;
      }

      selfPeerIdRef.current = result.selfPeerId;
      iceServersRef.current = result.iceServers;
      setViewState({
        localAudioEnabled: nextState.audioEnabled,
        localVideoEnabled: nextState.videoEnabled,
        isJoined: true,
        status: "joined",
        remoteParticipants: sortParticipantsByRoomOrder(
          result.participants.map((participant) => ({
            ...participant,
            stream: null,
            connectionState: "new" as const,
          })),
          roomPlayerIdsRef.current,
        ),
      });
    },
    [acquireTrack, closeAllPeerConnections, setViewState, showError, stopLocalTracks, translate],
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
        const socket = getSocket();
        desiredSessionRef.current = {
          shouldBeJoined: false,
          audioEnabled: false,
          videoEnabled: false,
        };

        if (socket?.connected && mediaSessionStore.getState().isJoined) {
          await emitActionAck(socket, "webrtc:leave-room");
        }

        selfPeerIdRef.current = null;
        setViewState({
          isJoined: false,
          status: "idle",
        });
        closeAllPeerConnections({ preserveParticipants: false });
        stopLocalTracks();
      },
      ["session", "audio", "video"],
    );
  }, [closeAllPeerConnections, mediaSessionStore, runMediaOperation, setViewState, stopLocalTracks]);

  const toggleAudio = useCallback(async () => {
    const needsJoin = !desiredSessionRef.current.shouldBeJoined;
    await runMediaOperation(needsJoin ? "session" : "audio", async () => {
      if (!desiredSessionRef.current.shouldBeJoined) {
        await joinMedia({ audioEnabled: true, videoEnabled: false });
        return;
      }

      const existingTrack = getLiveTrack("audio");
      if (!existingTrack) {
        const acquiredTrack = await acquireTrack("audio");
        if (!acquiredTrack) {
          return;
        }

        acquiredTrack.enabled = true;
        addTrackToPeers(acquiredTrack);
        desiredSessionRef.current.audioEnabled = true;
        setViewState({ localAudioEnabled: true });
        await emitMediaStateUpdate();
        return;
      }

      existingTrack.enabled = !desiredSessionRef.current.audioEnabled;
      desiredSessionRef.current.audioEnabled = existingTrack.enabled;
      setViewState({ localAudioEnabled: existingTrack.enabled });
      await emitMediaStateUpdate();
    }, needsJoin ? ["session", "audio", "video"] : ["audio", "session"]);
  }, [acquireTrack, addTrackToPeers, emitMediaStateUpdate, getLiveTrack, joinMedia, runMediaOperation, setViewState]);

  const toggleVideo = useCallback(async () => {
    const needsJoin = !desiredSessionRef.current.shouldBeJoined;
    await runMediaOperation(needsJoin ? "session" : "video", async () => {
      if (!desiredSessionRef.current.shouldBeJoined) {
        await joinMedia({ audioEnabled: false, videoEnabled: true });
        return;
      }

      if (desiredSessionRef.current.videoEnabled) {
        const track = getLiveTrack("video");
        if (track) {
          track.onended = null;
          track.stop();
          localStreamRef.current?.removeTrack(track);
        }
        removeTrackFromPeers("video");
        syncLocalStreamState();
        desiredSessionRef.current.videoEnabled = false;
        setViewState({ localVideoEnabled: false });
        await emitMediaStateUpdate();
        return;
      }

      const track = await acquireTrack("video");
      if (!track) {
        return;
      }

      track.enabled = true;
      addTrackToPeers(track);
      syncLocalStreamState();
      desiredSessionRef.current.videoEnabled = true;
      setViewState({ localVideoEnabled: true });
      await emitMediaStateUpdate();
    }, needsJoin ? ["session", "audio", "video"] : ["video", "session"]);
  }, [
    acquireTrack,
    addTrackToPeers,
    emitMediaStateUpdate,
    getLiveTrack,
    joinMedia,
    removeTrackFromPeers,
    runMediaOperation,
    setViewState,
    syncLocalStreamState,
  ]);

  useEffect(() => {
    void refreshDeviceAvailability();

    if (!navigator.mediaDevices?.addEventListener) {
      return;
    }

    const handleDeviceChange = () => {
      void refreshDeviceAvailability();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [refreshDeviceAvailability]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      return;
    }

    const handlePeerJoined = ({ participant }: { participant: MediaParticipant }) => {
      if (participant.peerId === selfPeerIdRef.current) {
        return;
      }

      if (peerConnectionsRef.current.has(participant.peerId)) {
        closePeerConnection(participant.peerId);
      }

      pendingIceCandidatesByPeerRef.current.delete(participant.peerId);
      upsertRemoteParticipant(participant, null);
      if (!desiredSessionRef.current.shouldBeJoined) {
        return;
      }

      createPeerConnection(participant);
    };

    const handlePeerLeft = ({ peerId }: { peerId: string }) => {
      closePeerConnection(peerId);
      removeRemoteParticipant(peerId);
    };

    const handlePeerMediaState = (participantState: { peerId: string; audioEnabled: boolean; videoEnabled: boolean }) => {
      if (participantState.peerId === selfPeerIdRef.current) {
        return;
      }

      setViewState((currentState) => ({
        remoteParticipants: currentState.remoteParticipants.map((participant) =>
          participant.peerId === participantState.peerId
            ? {
                ...participant,
                audioEnabled: participantState.audioEnabled,
                videoEnabled: participantState.videoEnabled,
              }
            : participant,
        ),
      }));
    };

    const handleConnect = () => {
      if (!desiredSessionRef.current.shouldBeJoined) {
        return;
      }

      closeAllPeerConnections({ preserveParticipants: true });
      void runMediaOperation(
        "session",
        async () =>
          joinMedia(
            {
              audioEnabled: desiredSessionRef.current.audioEnabled,
              videoEnabled: desiredSessionRef.current.videoEnabled,
            },
            true,
          ),
        ["session", "audio", "video"],
      );
    };

    const handleDisconnect = () => {
      if (!desiredSessionRef.current.shouldBeJoined) {
        return;
      }

      setViewState({ status: "reconnecting" });
      closeAllPeerConnections({ preserveParticipants: true });
    };

    const handleOfferEvent = ({ fromPeerId, offer }: MediaIncomingOffer) => {
      void handleIncomingOffer({ fromPeerId, offer });
    };
    const handleAnswerEvent = ({ fromPeerId, answer }: MediaIncomingAnswer) => {
      void handleIncomingAnswer({ fromPeerId, answer });
    };
    const handleIceCandidateEvent = ({ fromPeerId, candidate }: MediaIncomingIceCandidate) => {
      void handleIncomingIceCandidate({ fromPeerId, candidate });
    };

    socket.on("webrtc:peer-joined", handlePeerJoined);
    socket.on("webrtc:peer-left", handlePeerLeft);
    socket.on("webrtc:peer-media-state", handlePeerMediaState);
    socket.on("webrtc:offer", handleOfferEvent);
    socket.on("webrtc:answer", handleAnswerEvent);
    socket.on("webrtc:ice-candidate", handleIceCandidateEvent);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("webrtc:peer-joined", handlePeerJoined);
      socket.off("webrtc:peer-left", handlePeerLeft);
      socket.off("webrtc:peer-media-state", handlePeerMediaState);
      socket.off("webrtc:offer", handleOfferEvent);
      socket.off("webrtc:answer", handleAnswerEvent);
      socket.off("webrtc:ice-candidate", handleIceCandidateEvent);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [
    closeAllPeerConnections,
    closePeerConnection,
    createPeerConnection,
    handleIncomingAnswer,
    handleIncomingIceCandidate,
    handleIncomingOffer,
    joinMedia,
    removeRemoteParticipant,
    runMediaOperation,
    setViewState,
    translate,
    upsertRemoteParticipant,
  ]);

  useEffect(() => {
    return () => {
      desiredSessionRef.current = {
        shouldBeJoined: false,
        audioEnabled: false,
        videoEnabled: false,
      };
      closeAllPeerConnections({ preserveParticipants: false });
      stopLocalTracks();
    };
  }, [closeAllPeerConnections, stopLocalTracks]);

  useEffect(() => {
    if (isRoomSocketConnected) {
      return;
    }

    if (!desiredSessionRef.current.shouldBeJoined) {
      return;
    }

    setViewState({ status: "reconnecting" });
  }, [isRoomSocketConnected, setViewState]);

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
      <RoomMediaSessionActionsContext.Provider value={actions}>{children}</RoomMediaSessionActionsContext.Provider>
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
  const status = useStore(store, (s) => s.status);
  const isJoined = useStore(store, (s) => s.isJoined);
  return { status, isJoined };
}

export function useRoomMediaSessionLocalState() {
  const store = useRoomMediaSessionStoreApi();
  const localStream = useStore(store, (s) => s.localStream);
  const localAudioEnabled = useStore(store, (s) => s.localAudioEnabled);
  const localVideoEnabled = useStore(store, (s) => s.localVideoEnabled);
  return { localStream, localAudioEnabled, localVideoEnabled };
}

export function useRoomMediaSessionPendingState() {
  const store = useRoomMediaSessionStoreApi();
  const isUpdatingAudio = useStore(store, (s) => s.isUpdatingAudio);
  const isUpdatingVideo = useStore(store, (s) => s.isUpdatingVideo);
  const isUpdatingSession = useStore(store, (s) => s.isUpdatingSession);
  return { isUpdatingAudio, isUpdatingVideo, isUpdatingSession };
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
