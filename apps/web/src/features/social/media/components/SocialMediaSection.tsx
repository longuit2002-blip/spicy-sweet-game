"use client";

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { useRoomSessionStore } from "@/stores/room-session-store";
import { cn } from "@/lib/utils";
import {
  getMediaSessionStatusPresentation,
  MediaSessionControls,
  MediaTile,
} from "./media-session-ui";
import {
  useRoomMediaSessionActions,
  useRoomMediaSessionLocalState,
  useRoomMediaSessionPendingState,
  useRoomMediaSessionRemoteParticipants,
  useRoomMediaSessionStatusState,
} from "../room-media-session";

const SocialMediaHeader = memo(function SocialMediaHeader() {
  const { t } = useTranslation("game");
  const { status, isJoined } = useRoomMediaSessionStatusState();
  const statusPresentation = getMediaSessionStatusPresentation(t, {
    isJoined,
    status,
  });

  return (
    <>
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Icon name="videocam" size={22} className="shrink-0 text-primary" />
          <h3 className="font-headline truncate text-xs font-bold uppercase tracking-wider text-primary sm:text-sm">
            {t("game.video.title")}
          </h3>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide sm:px-2.5 sm:py-1 sm:text-ui-micro ${statusPresentation.toneClassName}`}
        >
          {statusPresentation.label}
        </span>
      </div>

      <p className="text-[0.7rem] leading-relaxed text-muted-foreground sm:text-xs">
        {isJoined
          ? t("game.video.liveHint", {
              defaultValue: "Mic and camera are opt-in. You can stay to watch even if both are off.",
            })
          : t("game.video.idleHint", {
              defaultValue: "Enable your mic or camera when you want to join the room call.",
            })}
      </p>
    </>
  );
});

const SocialMediaParticipantGrid = memo(function SocialMediaParticipantGrid() {
  const { t } = useTranslation("game");
  const maxPlayers = useRoomSessionStore((state) => state.maxPlayers);
  const { localStream, localAudioEnabled, localVideoEnabled } = useRoomMediaSessionLocalState();
  const remoteParticipants = useRoomMediaSessionRemoteParticipants();
  const remoteEmptySlotCount = Math.max(0, maxPlayers - 1 - remoteParticipants.length);

  return (
    <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:gap-3">
      <MediaTile
        label={t("game.video.you")}
        stream={localStream}
        showVideo={localVideoEnabled}
        audioEnabled={localAudioEnabled}
        videoEnabled={localVideoEnabled}
        isLocal
        aspect="square"
        placeholderMode="presence"
        showMediaIndicators
      />

      {remoteParticipants.map((participant) => (
        <MediaTile
          key={participant.peerId}
          label={participant.nickname}
          stream={participant.stream}
          showVideo={participant.videoEnabled}
          audioEnabled={participant.audioEnabled}
          videoEnabled={participant.videoEnabled}
          connectionState={participant.connectionState}
          aspect="square"
          placeholderMode="presence"
          showMediaIndicators
          showConnectingBadge
        />
      ))}

      {Array.from({ length: remoteEmptySlotCount }).map((_, index) => (
        <div
          key={`empty-${index}`}
          className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-outline/30 bg-surface-container-high sm:rounded-2xl"
        >
          <div className="flex flex-col items-center gap-0.5 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-outline/60 sm:gap-1 sm:text-ui-micro">
            <Icon name="person_add" size={16} className="text-outline/50" />
            <span>{t("game.video.waiting")}</span>
          </div>
        </div>
      ))}
    </div>
  );
});

const SocialMediaControlsSection = memo(function SocialMediaControlsSection() {
  const { isJoined } = useRoomMediaSessionStatusState();
  const { localAudioEnabled, localVideoEnabled } = useRoomMediaSessionLocalState();
  const { isUpdatingAudio, isUpdatingVideo, isUpdatingSession } = useRoomMediaSessionPendingState();
  const { toggleAudio, toggleVideo, leaveMedia } = useRoomMediaSessionActions();

  return (
    <MediaSessionControls
      isJoined={isJoined}
      localAudioEnabled={localAudioEnabled}
      localVideoEnabled={localVideoEnabled}
      isUpdatingAudio={isUpdatingAudio}
      isUpdatingVideo={isUpdatingVideo}
      isUpdatingSession={isUpdatingSession}
      onToggleAudio={toggleAudio}
      onToggleVideo={toggleVideo}
      onLeave={leaveMedia}
      size="sm"
    />
  );
});

export const SocialMediaSection = memo(function SocialMediaSection() {
  return (
    <div
      className={cn(
        "social-media-section-xl-short max-xl:max-h-[min(42vh,260px)] max-xl:shrink-0 max-xl:overflow-y-auto max-xl:kawaii-scrollbar space-y-2 p-3 sm:space-y-3 sm:p-4 xl:max-h-none xl:overflow-visible kawaii-scrollbar",
      )}
    >
      <SocialMediaHeader />
      <SocialMediaParticipantGrid />
      <SocialMediaControlsSection />
    </div>
  );
});
