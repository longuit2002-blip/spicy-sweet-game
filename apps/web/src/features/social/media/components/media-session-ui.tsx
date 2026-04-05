"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type MediaSessionStatus = "idle" | "joining" | "joined" | "reconnecting" | "disabled";
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
  controlsDisabled?: boolean;
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
  sm: "h-8 w-8 rounded-full sm:h-9 sm:w-9",
  md: "h-10 w-10 rounded-full sm:h-11 sm:w-11",
};

const CONTROL_ICON_STYLES: Record<MediaControlsSize, string> = {
  sm: "h-3.5 w-3.5 sm:h-4 sm:w-4",
  md: "h-4 w-4 sm:h-[18px] sm:w-[18px]",
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
  if (status === "disabled") {
    return {
      label: t("game.video.unavailable", { defaultValue: "Unavailable" }),
      toneClassName: "bg-muted text-muted-foreground",
    };
  }

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
  controlsDisabled = false,
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
  const iconClassName = CONTROL_ICON_STYLES[size];

  return (
    <div className="flex justify-center gap-1.5 pt-1 sm:gap-2">
      <Button
        variant={isJoined && localAudioEnabled ? "secondary" : "outline"}
        size="icon"
        onClick={() => {
          void onToggleAudio();
        }}
        disabled={controlsDisabled || isUpdatingAudio}
        className={buttonClassName}
        aria-label={
          localAudioEnabled
            ? t("game.video.disableAudio", { defaultValue: "Mute microphone" })
            : t("game.video.enableAudio", { defaultValue: "Enable microphone" })
        }
      >
        {localAudioEnabled ? <Mic className={iconClassName} /> : <MicOff className={iconClassName} />}
      </Button>

      <Button
        variant={isJoined && localVideoEnabled ? "secondary" : "outline"}
        size="icon"
        onClick={() => {
          void onToggleVideo();
        }}
        disabled={controlsDisabled || isUpdatingVideo}
        className={buttonClassName}
        aria-label={
          localVideoEnabled
            ? t("game.video.disableVideo", { defaultValue: "Turn camera off" })
            : t("game.video.enableVideo", { defaultValue: "Enable camera" })
        }
      >
        {localVideoEnabled ? <Video className={iconClassName} /> : <VideoOff className={iconClassName} />}
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
        <PhoneOff className={iconClassName} />
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
  const [remoteSoundUnlocked, setRemoteSoundUnlocked] = useState(false);

  useEffect(() => {
    if (!isLocal) {
      setRemoteSoundUnlocked(false);
    }
  }, [isLocal, stream]);

  const tryPlayVideo = useCallback((element: HTMLVideoElement | null) => {
    if (!element) {
      return;
    }
    void element.play().catch(() => {
      /* Autoplay policy may block; user can tap “sound” for remote tiles. */
    });
  }, []);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    element.srcObject = stream;

    const refreshPlayback = () => {
      tryPlayVideo(element);
    };

    if (stream) {
      stream.addEventListener("addtrack", refreshPlayback);
      stream.addEventListener("removetrack", refreshPlayback);
    }

    tryPlayVideo(element);

    return () => {
      if (stream) {
        stream.removeEventListener("addtrack", refreshPlayback);
        stream.removeEventListener("removetrack", refreshPlayback);
      }
    };
  }, [stream, tryPlayVideo]);

  useEffect(() => {
    if (!isLocal && remoteSoundUnlocked) {
      tryPlayVideo(videoRef.current);
    }
  }, [remoteSoundUnlocked, isLocal, tryPlayVideo]);

  const isSquare = aspect === "square";
  const showActiveVideo = Boolean(stream && showVideo);
  const remoteMutedForAutoplay = !isLocal && !remoteSoundUnlocked;
  const showRemoteSoundHint = !isLocal && Boolean(stream) && remoteMutedForAutoplay;

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        isSquare
          ? "aspect-square rounded-xl border-2 border-white/70 bg-surface-container-high shadow-sm sm:rounded-2xl"
          : "aspect-video rounded-xl border border-border/30 bg-black shadow-inner sm:rounded-2xl",
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        muted={isLocal ? true : remoteMutedForAutoplay}
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
          <Icon name={videoEnabled ? "person" : "videocam_off"} size={22} className="text-muted-foreground" />
        ) : (
          <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" />
        )}
      </div>

      {showMediaIndicators ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1.5 bg-black/45 px-1.5 py-0.5 text-[0.65rem] text-white sm:gap-2 sm:px-2 sm:py-1 sm:text-ui-micro">
          <span className="truncate font-semibold">{label}</span>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            {audioEnabled ? <Mic className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : <MicOff className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
            {videoEnabled ? <Video className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : <VideoOff className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
          </div>
        </div>
      ) : (
        <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[0.65rem] text-white sm:text-ui-micro">
          {label}
        </div>
      )}

      {showRemoteSoundHint ? (
        <button
          type="button"
          className="absolute inset-x-2 bottom-10 z-10 rounded-lg bg-primary/90 px-2 py-1.5 text-center text-[0.65rem] font-semibold text-primary-foreground shadow-sm sm:bottom-12 sm:inset-x-3 sm:text-xs"
          aria-label={t("game.video.tapForSoundAria", {
            defaultValue: "Enable sound for this participant (required on some mobile browsers)",
          })}
          onClick={() => {
            setRemoteSoundUnlocked(true);
            tryPlayVideo(videoRef.current);
          }}
        >
          {t("game.video.tapForSound", { defaultValue: "Tap for sound" })}
        </button>
      ) : null}

      {showConnectingBadge && !isLocal && connectionState === "new" ? (
        <div className="absolute left-1.5 top-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-ui-tiny">
          {t("game.video.connecting", { defaultValue: "Connecting" })}
        </div>
      ) : null}
    </div>
  );
});
