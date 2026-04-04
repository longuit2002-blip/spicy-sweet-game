"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
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
import { useRoomStore } from "@/stores/roomStore";

type MediaSessionStatus = "idle" | "joining" | "joined" | "reconnecting";

interface RemoteParticipantView extends MediaParticipant {
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState | "new";
}

interface RoomMediaSessionContextValue {
  status: MediaSessionStatus;
  error: string | null;
  localStream: MediaStream | null;
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
  remoteParticipants: RemoteParticipantView[];
  isJoined: boolean;
  clearError: () => void;
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

const DEFAULT_CONTEXT_VALUE: RoomMediaSessionContextValue = {
  status: "idle",
  error: null,
  localStream: null,
  localAudioEnabled: false,
  localVideoEnabled: false,
  remoteParticipants: [],
  isJoined: false,
  clearError: () => {},
  toggleAudio: async () => {},
  toggleVideo: async () => {},
  leaveMedia: async () => {},
};

const RoomMediaSessionContext = createContext<RoomMediaSessionContextValue>(DEFAULT_CONTEXT_VALUE);

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

function toDeviceErrorMessage(error: unknown, t: (key: string, defaultValue: string) => string): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return t(
          "game.video.errors.permissionDenied",
          "Browser permission is required to use your camera or microphone.",
        );
      case "NotFoundError":
      case "DevicesNotFoundError":
        return t("game.video.errors.deviceNotFound", "No compatible camera or microphone was found.");
      case "NotReadableError":
      case "TrackStartError":
        return t("game.video.errors.deviceBusy", "Your camera or microphone is busy in another app.");
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return t(
          "game.video.errors.unsupportedConstraints",
          "This device cannot satisfy the requested media quality.",
        );
      default:
        return t("game.video.errors.deviceUnavailable", "Camera or microphone is unavailable right now.");
    }
  }

  return t("game.video.errors.deviceUnavailable", "Camera or microphone is unavailable right now.");
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

  const [status, setStatus] = useState<MediaSessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(false);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipantView[]>([]);
  const [isJoined, setIsJoined] = useState(false);

  const roomPlayerIdsRef = useRef<readonly string[]>(roomPlayers.map((player) => player.id));
  const localStreamRef = useRef<MediaStream | null>(null);
  const selfPeerIdRef = useRef<string | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const peerConnectionsRef = useRef<Map<string, PeerRuntime>>(new Map());
  const pendingIceCandidatesByPeerRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const desiredSessionRef = useRef({
    shouldBeJoined: false,
    audioEnabled: false,
    videoEnabled: false,
  });
  const roomCodeRef = useRef(roomCode);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
    roomPlayerIdsRef.current = roomPlayers.map((player) => player.id);
    setRemoteParticipants((currentParticipants) =>
      sortParticipantsByRoomOrder(
        currentParticipants.map((participant) => {
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
    );
  }, [roomPlayers]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const syncLocalStreamState = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      setLocalStream(null);
      return;
    }

    setLocalStream(new MediaStream(stream.getTracks()));
  }, []);

  const upsertRemoteParticipant = useCallback((participant: MediaParticipant, stream?: MediaStream | null) => {
    setRemoteParticipants((currentParticipants) => {
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
      return sortParticipantsByRoomOrder([...withoutParticipant, nextParticipant], roomPlayerIdsRef.current);
    });
  }, [roomPlayers]);

  const updateRemoteConnectionState = useCallback(
    (peerId: string, connectionState: RTCPeerConnectionState | "new") => {
      setRemoteParticipants((currentParticipants) =>
        currentParticipants.map((participant) =>
          participant.peerId === peerId ? { ...participant, connectionState } : participant,
        ),
      );
    },
    [],
  );

  const removeRemoteParticipant = useCallback((peerId: string) => {
    setRemoteParticipants((currentParticipants) =>
      currentParticipants.filter((participant) => participant.peerId !== peerId),
    );
  }, []);

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
        setRemoteParticipants((currentParticipants) =>
          currentParticipants.map((participant) => ({
            ...participant,
            stream: null,
            connectionState: "new",
          })),
        );
        return;
      }

      setRemoteParticipants([]);
    },
    [closePeerConnection],
  );

  const stopLocalTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalAudioEnabled(false);
    setLocalVideoEnabled(false);
    syncLocalStreamState();
  }, [syncLocalStreamState]);

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

  const acquireTrack = useCallback(
    async (kind: "audio" | "video") => {
      const existingTrack = getLiveTrack(kind);
      if (existingTrack) {
        return existingTrack;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError(translate("game.video.errors.deviceUnavailable", "Camera or microphone is unavailable right now."));
        return null;
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
          setError(translate("game.video.errors.deviceUnavailable", "Camera or microphone is unavailable right now."));
          return null;
        }

        ensureLocalStreamContainer().addTrack(track);
        syncLocalStreamState();
        return track;
      } catch (deviceError) {
        setError(toDeviceErrorMessage(deviceError, translate));
        return null;
      }
    },
    [ensureLocalStreamContainer, getLiveTrack, syncLocalStreamState, translate],
  );

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
      setError(toActionFailureMessage(result.code, result.message, translate));
    }
  }, [translate]);

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
        remoteParticipants.find((item) => item.peerId === fromPeerId) ??
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
    [createPeerConnection, flushPendingIceCandidates, remoteParticipants, roomPlayers],
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
        setError(
          translate(
            "game.video.errors.socketNotReady",
            "The room connection is still starting. Try again in a moment.",
          ),
        );
        return;
      }

      setError(null);
      setStatus(isReconnect ? "reconnecting" : "joining");

      if (nextState.audioEnabled) {
        const audioTrack = await acquireTrack("audio");
        if (!audioTrack) {
          setStatus("idle");
          return;
        }
        audioTrack.enabled = true;
      }

      if (nextState.videoEnabled) {
        const videoTrack = await acquireTrack("video");
        if (!videoTrack) {
          setStatus("idle");
          return;
        }
        videoTrack.enabled = true;
      }

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
        setIsJoined(false);
        setStatus("idle");
        setError(toActionFailureMessage(result.code, result.message, translate));
        return;
      }

      selfPeerIdRef.current = result.selfPeerId;
      iceServersRef.current = result.iceServers;
      setLocalAudioEnabled(nextState.audioEnabled);
      setLocalVideoEnabled(nextState.videoEnabled);
      setIsJoined(true);
      setStatus("joined");
      setRemoteParticipants(
        sortParticipantsByRoomOrder(
          result.participants.map((participant) => ({
            ...participant,
            stream: null,
            connectionState: "new" as const,
          })),
          roomPlayerIdsRef.current,
        ),
      );
    },
    [acquireTrack, closeAllPeerConnections, stopLocalTracks, translate],
  );

  const leaveMedia = useCallback(async () => {
    const socket = getSocket();
    desiredSessionRef.current = {
      shouldBeJoined: false,
      audioEnabled: false,
      videoEnabled: false,
    };

    if (socket?.connected && isJoined) {
      await emitActionAck(socket, "webrtc:leave-room");
    }

    selfPeerIdRef.current = null;
    setIsJoined(false);
    setStatus("idle");
    setError(null);
    closeAllPeerConnections({ preserveParticipants: false });
    stopLocalTracks();
  }, [closeAllPeerConnections, isJoined, stopLocalTracks]);

  const toggleAudio = useCallback(async () => {
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
      setLocalAudioEnabled(true);
      await emitMediaStateUpdate();
      return;
    }

    existingTrack.enabled = !desiredSessionRef.current.audioEnabled;
    desiredSessionRef.current.audioEnabled = existingTrack.enabled;
    setLocalAudioEnabled(existingTrack.enabled);
    await emitMediaStateUpdate();
  }, [acquireTrack, addTrackToPeers, emitMediaStateUpdate, getLiveTrack, joinMedia]);

  const toggleVideo = useCallback(async () => {
    if (!desiredSessionRef.current.shouldBeJoined) {
      await joinMedia({ audioEnabled: false, videoEnabled: true });
      return;
    }

    if (desiredSessionRef.current.videoEnabled) {
      const track = getLiveTrack("video");
      track?.stop();
      if (track && localStreamRef.current) {
        localStreamRef.current.removeTrack(track);
      }
      removeTrackFromPeers("video");
      syncLocalStreamState();
      desiredSessionRef.current.videoEnabled = false;
      setLocalVideoEnabled(false);
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
    setLocalVideoEnabled(true);
    await emitMediaStateUpdate();
  }, [
    acquireTrack,
    addTrackToPeers,
    emitMediaStateUpdate,
    getLiveTrack,
    joinMedia,
    removeTrackFromPeers,
    syncLocalStreamState,
  ]);

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

      setRemoteParticipants((currentParticipants) =>
        currentParticipants.map((participant) =>
          participant.peerId === participantState.peerId
            ? {
                ...participant,
                audioEnabled: participantState.audioEnabled,
                videoEnabled: participantState.videoEnabled,
              }
            : participant,
        ),
      );
    };

    const handleConnect = () => {
      if (!desiredSessionRef.current.shouldBeJoined) {
        return;
      }

      closeAllPeerConnections({ preserveParticipants: true });
      void joinMedia(
        {
          audioEnabled: desiredSessionRef.current.audioEnabled,
          videoEnabled: desiredSessionRef.current.videoEnabled,
        },
        true,
      );
    };

    const handleDisconnect = () => {
      if (!desiredSessionRef.current.shouldBeJoined) {
        return;
      }

      setStatus("reconnecting");
      setError(translate("game.video.reconnecting", "Reconnecting call…"));
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

    setStatus("reconnecting");
    setError(translate("game.video.reconnecting", "Reconnecting call…"));
  }, [isRoomSocketConnected, translate]);

  const value = useMemo<RoomMediaSessionContextValue>(
    () => ({
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
    }),
    [
      clearError,
      error,
      isJoined,
      leaveMedia,
      localAudioEnabled,
      localStream,
      localVideoEnabled,
      remoteParticipants,
      status,
      toggleAudio,
      toggleVideo,
    ],
  );

  return <RoomMediaSessionContext.Provider value={value}>{children}</RoomMediaSessionContext.Provider>;
}

export function useRoomMediaSession() {
  return useContext(RoomMediaSessionContext);
}
