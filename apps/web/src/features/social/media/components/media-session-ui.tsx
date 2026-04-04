"use client";

import { memo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type MediaSessionStatus = "idle" | "joining" | "joined" | "reconnecting";
type MediaTileAspect = "square" | "video";
type MediaTilePlaceholderMode = "presence" | "video-off";
type MediaControlsSize = "sm" | "md";

interface MediaStatusPresentation {
  label: string;
  toneClassName: string;
}

interface MediaControlsProps {
  isJoined: boolean;
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
  isUpdatingAudio: boolean;
  isUpdatingVideo: boolean;
  isUpdatingSession: boolean;
  onToggleAudio: () => Promise<void>;
  onToggleVideo: () => Promise<void>;
  onLeave: () => Promise<void>;
  size?: MediaControlsSize;
}

interface MediaTileProps {
  label: string;
  stream: MediaStream | null;
  showVideo: boolean;
  videoEnabled: boolean;
  audioEnabled?: boolean;
  connectionState?: RTCPeerConnectionState | "new";
  isLocal?: boolean;
  aspect?: MediaTileAspect;
  placeholderMode?: MediaTilePlaceholderMode;
  showMediaIndicators?: boolean;
  showConnectingBadge?: boolean;
}

const CONTROL_SIZE_STYLES: Record<MediaControlsSize, string> = {
  sm: "h-9 w-9 rounded-full",
  md: "h-11 w-11 rounded-full",
};

export function getMediaSessionStatusPresentation(
  t: (key: string, options?: { defaultValue?: string }) => string,
  {
    isJoined,
    status,
  }: {
    isJoined: boolean;
    status: MediaSessionStatus;
  },
): MediaStatusPresentation {
  if (isJoined) {
    return {
      label: t("game.video.connected"),
      toneClassName: "bg-emerald-500/15 text-emerald-700",
    };
  }

  if (status === "reconnecting") {
    return {
      label: t("game.video.reconnecting", { defaultValue: "Reconnecting call…" }),
      toneClassName: "bg-trophy-gold/15 text-foreground",
    };
  }

  return {
    label: t("game.video.idle", { defaultValue: "Idle" }),
    toneClassName: "bg-muted text-muted-foreground",
  };
}

export const MediaSessionControls = memo(function MediaSessionControls({
  isJoined,
  localAudioEnabled,
  localVideoEnabled,
  isUpdatingAudio,
  isUpdatingVideo,
  isUpdatingSession,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  size = "sm",
}: MediaControlsProps) {
  const { t } = useTranslation("game");
  const buttonClassName = cn(
    CONTROL_SIZE_STYLES[size],
    "cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-auto",
  );

  return (
    <div className="flex justify-center gap-2 pt-1">
      <Button
        variant={isJoined && localAudioEnabled ? "secondary" : "outline"}
        size="icon"
        onClick={() => {
          void onToggleAudio();
        }}
        disabled={isUpdatingAudio}
        className={buttonClassName}
        aria-label={
          localAudioEnabled
            ? t("game.video.disableAudio", { defaultValue: "Mute microphone" })
            : t("game.video.enableAudio", { defaultValue: "Enable microphone" })
        }
      >
        {localAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
      </Button>

      <Button
        variant={isJoined && localVideoEnabled ? "secondary" : "outline"}
        size="icon"
        onClick={() => {
          void onToggleVideo();
        }}
        disabled={isUpdatingVideo}
        className={buttonClassName}
        aria-label={
          localVideoEnabled
            ? t("game.video.disableVideo", { defaultValue: "Turn camera off" })
            : t("game.video.enableVideo", { defaultValue: "Enable camera" })
        }
      >
        {localVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
      </Button>

      <Button
        variant="destructive"
        size="icon"
        className={buttonClassName}
        onClick={() => {
          void onLeave();
        }}
        disabled={!isJoined || isUpdatingSession}
        aria-label={t("game.video.leave", { defaultValue: "Leave call" })}
      >
        <PhoneOff className="h-4 w-4" />
      </Button>
    </div>
  );
});

export const MediaTile = memo(function MediaTile({
  label,
  stream,
  showVideo,
  videoEnabled,
  audioEnabled,
  connectionState,
  isLocal = false,
  aspect = "square",
  placeholderMode = "video-off",
  showMediaIndicators = false,
  showConnectingBadge = false,
}: MediaTileProps) {
  const { t } = useTranslation("game");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.srcObject = stream;
  }, [stream]);

  const isSquare = aspect === "square";
  const showActiveVideo = Boolean(stream && showVideo);

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        isSquare
          ? "aspect-square rounded-2xl border-2 border-white/70 bg-surface-container-high shadow-sm"
          : "aspect-video rounded-2xl border border-border/30 bg-black shadow-inner",
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        muted={isLocal}
        playsInline
        className={cn(
          "h-full w-full object-cover transition-opacity duration-150",
          showActiveVideo ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-150",
          isSquare
            ? "bg-gradient-to-br from-card via-muted/60 to-muted"
            : "text-muted-foreground",
          showActiveVideo ? "opacity-0" : "opacity-100",
        )}
        aria-hidden={showActiveVideo}
      >
        {placeholderMode === "presence" ? (
          <Icon name={videoEnabled ? "person" : "videocam_off"} size={28} className="text-muted-foreground" />
        ) : (
          <VideoOff className="h-6 w-6" />
        )}
      </div>

      {showMediaIndicators ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/45 px-2 py-1 text-ui-micro text-white">
          <span className="truncate font-semibold">{label}</span>
          <div className="flex items-center gap-1">
            {audioEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
            {videoEnabled ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
          </div>
        </div>
      ) : (
        <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-ui-micro text-white">
          {label}
        </div>
      )}

      {showConnectingBadge && !isLocal && connectionState === "new" ? (
        <div className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-1 text-ui-tiny font-semibold uppercase tracking-wide text-white">
          {t("game.video.connecting", { defaultValue: "Connecting" })}
        </div>
      ) : null}
    </div>
  );
});
