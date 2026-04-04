import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { useWebRTC } from "@/hooks/useWebRTC";

interface VideoPanelProps {
  roomCode?: string;
  userId?: string;
}

export function VideoPanel({ roomCode = "", userId = "" }: VideoPanelProps) {
  const { t } = useTranslation("game");
  const {
    localStream,
    localAudioEnabled,
    localVideoEnabled,
    remoteParticipants,
    isJoined,
    toggleAudio,
    toggleVideo,
    leaveMedia,
  } = useWebRTC(roomCode || userId);

  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  return (
    <div className="flex flex-col gap-3 border-t border-border/20 bg-muted/10 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold">{t("game.video.title")}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {isJoined
            ? t("game.video.connected")
            : t("game.video.idle", { defaultValue: "Idle" })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/30 bg-black shadow-inner">
          {localStream && localVideoEnabled ? (
            <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <VideoOff className="h-6 w-6" />
            </div>
          )}
          <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white">
            {t("game.video.you")}
          </div>
        </div>

        {remoteParticipants.slice(0, 1).map((participant) => (
          <RemoteVideoTile
            key={participant.peerId}
            label={participant.nickname}
            stream={participant.stream}
            showVideo={participant.videoEnabled}
          />
        ))}
      </div>

      <div className="flex justify-center gap-2 pt-1">
        <Button
          variant={localAudioEnabled ? "secondary" : "outline"}
          size="icon"
          className="h-11 w-11 rounded-full"
          onClick={() => {
            void toggleAudio();
          }}
        >
          {localAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>

        <Button
          variant={localVideoEnabled ? "secondary" : "outline"}
          size="icon"
          className="h-11 w-11 rounded-full"
          onClick={() => {
            void toggleVideo();
          }}
        >
          {localVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>

        <Button
          variant="destructive"
          size="icon"
          className="h-11 w-11 rounded-full"
          onClick={() => {
            void leaveMedia();
          }}
          disabled={!isJoined}
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function RemoteVideoTile({
  label,
  stream,
  showVideo,
}: {
  label: string;
  stream: MediaStream | null;
  showVideo: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/30 bg-black shadow-inner">
      {stream && showVideo ? (
        <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <VideoOff className="h-6 w-6" />
        </div>
      )}
      <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white">
        {label}
      </div>
    </div>
  );
}

