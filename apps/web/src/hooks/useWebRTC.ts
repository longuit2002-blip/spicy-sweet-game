"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  peers: PeerConnection[];
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isConnected: boolean;
  error: string | null;
  startLocalStream: (video?: boolean, audio?: boolean) => Promise<MediaStream | null>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  endCall: () => void;
  handleOffer: (peerId: string, offer: RTCSessionDescriptionInit) => Promise<void>;
  handleAnswer: (peerId: string, answer: RTCSessionDescriptionInit) => Promise<void>;
  handleIceCandidate: (peerId: string, candidate: RTCIceCandidateInit) => Promise<void>;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export function useWebRTC(roomCode: string | null): UseWebRTCReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerConnection[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const cleanupPeerConnection = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    setPeers((prev) => prev.filter((p) => p.peerId !== peerId));
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const socket = getSocket();
          socket?.emit("webrtc:ice-candidate", { peerId, candidate: event.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setIsConnected(true);
        } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          cleanupPeerConnection(peerId);
        }
      };

      pc.ontrack = (event) => {
        setPeers((prev) => {
          const existing = prev.find((p) => p.peerId === peerId);
          if (existing) {
            return prev.map((p) =>
              p.peerId === peerId ? { ...p, stream: event.streams[0] } : p,
            );
          }
          return [...prev, { peerId, connection: pc, stream: event.streams[0] }];
        });
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      peerConnectionsRef.current.set(peerId, pc);
      return pc;
    },
    [cleanupPeerConnection],
  );

  const startLocalStream = useCallback(async (video = true, audio = true): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720, facingMode: "user" } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsAudioEnabled(audio);
      setIsVideoEnabled(video);
      setError(null);

      if (roomCode) {
        const socket = getSocket();
        socket?.emit("webrtc:join-room", roomCode);
      }

      peerConnectionsRef.current.forEach((pc) => {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      });

      return stream;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to access camera/microphone";
      console.error("Media device error:", message);
      setError(message);
      return null;
    }
  }, [roomCode]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled((prev) => !prev);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled((prev) => !prev);
    }
  }, []);

  const endCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);

    peerConnectionsRef.current.forEach((pc) => {
      pc.close();
    });
    peerConnectionsRef.current.clear();
    setPeers([]);
    setIsConnected(false);

    const socket = getSocket();
    socket?.emit("webrtc:leave-room");
  }, []);

  const handleOffer = useCallback(
    async (peerId: string, offer: RTCSessionDescriptionInit) => {
      try {
        let pc = peerConnectionsRef.current.get(peerId);
        if (!pc) {
          pc = createPeerConnection(peerId);
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const socket = getSocket();
        socket?.emit("webrtc:answer", { peerId, answer });
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    },
    [createPeerConnection],
  );

  const handleAnswer = useCallback(async (peerId: string, answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnectionsRef.current.get(peerId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (err) {
      console.error("Error handling answer:", err);
    }
  }, []);

  const handleIceCandidate = useCallback(async (peerId: string, candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnectionsRef.current.get(peerId);
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error("Error handling ICE candidate:", err);
    }
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    const socket = getSocket();
    if (!socket) return;

    const onPeerJoined = ({ peerId }: { peerId: string }) => {
      const pc = createPeerConnection(peerId);
      void pc.createOffer().then((offer) => {
        void pc.setLocalDescription(offer);
        socket.emit("webrtc:offer", { peerId, offer });
      });
    };

    socket.on("webrtc:peer-joined", onPeerJoined);

    socket.on("webrtc:peer-left", ({ peerId }: { peerId: string }) => {
      cleanupPeerConnection(peerId);
    });

    socket.on("webrtc:offer", ({ peerId, offer }: { peerId: string; offer: RTCSessionDescriptionInit }) => {
      void handleOffer(peerId, offer);
    });

    socket.on("webrtc:answer", ({ peerId, answer }: { peerId: string; answer: RTCSessionDescriptionInit }) => {
      void handleAnswer(peerId, answer);
    });

    socket.on(
      "webrtc:ice-candidate",
      ({ peerId, candidate }: { peerId: string; candidate: RTCIceCandidateInit }) => {
        void handleIceCandidate(peerId, candidate);
      },
    );

    return () => {
      socket.off("webrtc:peer-joined", onPeerJoined);
      socket.off("webrtc:peer-left");
      socket.off("webrtc:offer");
      socket.off("webrtc:answer");
      socket.off("webrtc:ice-candidate");
    };
  }, [roomCode, createPeerConnection, cleanupPeerConnection, handleOffer, handleAnswer, handleIceCandidate]);

  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    localStream,
    peers,
    isAudioEnabled,
    isVideoEnabled,
    isConnected,
    error,
    startLocalStream,
    toggleAudio,
    toggleVideo,
    endCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
  };
}
