import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff } from 'lucide-react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { cn } from '@/lib/utils';

interface VideoPanelProps {
  roomCode?: string;
  userId?: string;
}

export function VideoPanel({ roomCode = '', userId = '' }: VideoPanelProps) {
  const { t } = useTranslation('game');
  const {
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
  } = useWebRTC(roomCode);

  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleToggleVideo = async () => {
    if (!localStream) {
      await startLocalStream(true, isAudioEnabled);
    } else {
      toggleVideo();
    }
  };

  const handleToggleAudio = () => {
    if (!localStream) {
      startLocalStream(isVideoEnabled, true);
    } else {
      toggleAudio();
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border/20 bg-muted/10 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold">{t('game.video.title')}</span>
        <div className="flex gap-1">
          <Button
            variant={isConnected ? 'kawaii' : 'outline'}
            size="sm"
            className="h-8 rounded-full px-4 text-xs"
            onClick={() => {
              if (!localStream) {
                startLocalStream(true, true);
              }
            }}
          >
            {isConnected ? t('game.video.connected') : t('game.video.connect')}
          </Button>
        </div>
      </div>

      {error && <div className="text-xs text-destructive px-2">{error}</div>}

      <div className="grid grid-cols-2 gap-2">
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/30 bg-black shadow-inner">
          {localStream && isVideoEnabled ? (
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Icon name="videocam_off" size={28} />
            </div>
          )}
          <div className="absolute bottom-1 left-1 text-[10px] text-white bg-black/50 px-1 rounded">
            {t('game.video.you')}
          </div>
        </div>

        {peers.slice(0, 3).map((peer) => (
          <div key={peer.peerId} className="relative aspect-video overflow-hidden rounded-2xl border border-border/30 bg-black shadow-inner">
            {peer.stream ? (
              <VideoStream stream={peer.stream} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Icon name="videocam_off" size={28} />
              </div>
            )}
            <div className="absolute bottom-1 left-1 text-[10px] text-white bg-black/50 px-1 rounded">
              {t('game.video.player')}
            </div>
          </div>
        ))}

        {peers.length < 3 &&
          Array.from({ length: 3 - peers.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-border/40 bg-muted/50"
            >
              <span className="text-muted-foreground/50 text-xs">{t('game.video.waiting')}</span>
            </div>
          ))}
      </div>

      <div className="flex justify-center gap-2 pt-1">
        <Button
          variant={isAudioEnabled ? 'secondary' : 'destructive'}
          size="icon"
          className="h-11 w-11 rounded-full"
          onClick={handleToggleAudio}
        >
          {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>

        <Button
          variant={isVideoEnabled ? 'secondary' : 'destructive'}
          size="icon"
          className="h-11 w-11 rounded-full"
          onClick={handleToggleVideo}
        >
          {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>

        <Button
          variant={localStream ? 'destructive' : 'outline'}
          size="icon"
          className="h-11 w-11 rounded-full"
          onClick={endCall}
          disabled={!localStream}
        >
          {localStream ? <PhoneOff className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function VideoStream({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />;
}

