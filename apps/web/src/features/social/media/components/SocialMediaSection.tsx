"use client";

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { useRoomStore } from "@/stores/roomStore";
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon name="videocam" size={24} className="text-primary" />
          <h3 className="font-headline text-sm font-bold uppercase tracking-wider text-primary">
            {t("game.video.title")}
          </h3>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-ui-micro font-semibold uppercase tracking-wide ${statusPresentation.toneClassName}`}
        >
          {statusPresentation.label}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
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
  const maxPlayers = useRoomStore((state) => state.maxPlayers);
  const { localStream, localAudioEnabled, localVideoEnabled } = useRoomMediaSessionLocalState();
  const remoteParticipants = useRoomMediaSessionRemoteParticipants();
  const remoteEmptySlotCount = Math.max(0, maxPlayers - 1 - remoteParticipants.length);

  return (
    <div className="grid grid-cols-2 gap-3">
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
          className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-outline/30 bg-surface-container-high"
        >
          <div className="flex flex-col items-center gap-1 text-center text-ui-micro font-semibold uppercase tracking-wide text-outline/60">
            <Icon name="person_add" size={18} className="text-outline/50" />
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
    <div className="space-y-3 p-4">
      <SocialMediaHeader />
      <SocialMediaParticipantGrid />
      <SocialMediaControlsSection />
    </div>
  );
});
