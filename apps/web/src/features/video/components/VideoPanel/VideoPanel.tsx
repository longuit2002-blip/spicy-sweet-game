import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
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
    <div className="flex flex-col gap-2 p-2 bg-card">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium">{t('game.video.title')}</span>
        <div className="flex gap-1">
          <Button
            variant={isConnected ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs"
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
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          {localStream && isVideoEnabled ? (
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <span className="text-2xl">👤</span>
            </div>
          )}
          <div className="absolute bottom-1 left-1 text-[10px] text-white bg-black/50 px-1 rounded">
            {t('game.video.you')}
          </div>
        </div>

        {peers.slice(0, 3).map((peer) => (
          <div key={peer.peerId} className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {peer.stream ? (
              <VideoStream stream={peer.stream} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <span className="text-2xl">👤</span>
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
              className="aspect-video bg-muted rounded-lg flex items-center justify-center"
            >
              <span className="text-muted-foreground/50 text-xs">{t('game.video.waiting')}</span>
            </div>
          ))}
      </div>

      <div className="flex justify-center gap-2 pt-2">
        <Button
          variant={isAudioEnabled ? 'default' : 'destructive'}
          size="icon"
          className="h-8 w-8"
          onClick={handleToggleAudio}
        >
          {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>

        <Button
          variant={isVideoEnabled ? 'default' : 'destructive'}
          size="icon"
          className="h-8 w-8"
          onClick={handleToggleVideo}
        >
          {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>

        <Button
          variant={localStream ? 'destructive' : 'outline'}
          size="icon"
          className="h-8 w-8"
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

