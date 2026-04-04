import { useTranslation } from "react-i18next";
import {
  getMediaSessionStatusPresentation,
  MediaSessionControls,
  MediaTile,
} from "@/features/social/media/components/media-session-ui";
import {
  useRoomMediaSessionActions,
  useRoomMediaSessionLocalState,
  useRoomMediaSessionPendingState,
  useRoomMediaSessionRemoteParticipants,
  useRoomMediaSessionStatusState,
} from "@/features/social/media/room-media-session";

interface VideoPanelProps {
  roomCode?: string;
  userId?: string;
}

export function VideoPanel({ roomCode = "", userId = "" }: VideoPanelProps) {
  const { t } = useTranslation("game");
  const { status, isJoined } = useRoomMediaSessionStatusState();
  const { localStream, localAudioEnabled, localVideoEnabled } = useRoomMediaSessionLocalState();
  const { isUpdatingAudio, isUpdatingVideo, isUpdatingSession } = useRoomMediaSessionPendingState();
  const remoteParticipants = useRoomMediaSessionRemoteParticipants();
  const { toggleAudio, toggleVideo, leaveMedia } = useRoomMediaSessionActions();
  const statusPresentation = getMediaSessionStatusPresentation(t, {
    isJoined,
    status,
  });

  return (
    <div className="flex flex-col gap-3 border-t border-border/20 bg-muted/10 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold">{t("game.video.title")}</span>
        <span className="text-ui-micro font-semibold uppercase tracking-wide text-muted-foreground">
          {statusPresentation.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MediaTile
          label={t("game.video.you")}
          stream={localStream}
          showVideo={localVideoEnabled}
          videoEnabled={localVideoEnabled}
          isLocal
          aspect="video"
        />

        {remoteParticipants.slice(0, 1).map((participant) => (
          <MediaTile
            key={participant.peerId}
            label={participant.nickname}
            stream={participant.stream}
            showVideo={participant.videoEnabled}
            videoEnabled={participant.videoEnabled}
            aspect="video"
          />
        ))}
      </div>

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
        size="md"
      />
    </div>
  );
}

