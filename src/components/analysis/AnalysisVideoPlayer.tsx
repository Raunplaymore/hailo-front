import {
  Maximize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  KeyboardEvent,
  ReactNode,
  RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type AnalysisVideoPlayerProps = {
  src: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  mediaRef: RefObject<HTMLDivElement | null>;
  currentTimeMs: number;
  disabled?: boolean;
  children?: ReactNode;
  onTimeChange: (timeMs: number) => void;
  onLoadedMetadata?: (video: HTMLVideoElement) => void;
};

type IOSVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

export function AnalysisVideoPlayer({
  src,
  videoRef,
  mediaRef,
  currentTimeMs,
  disabled = false,
  children,
  onTimeChange,
  onLoadedMetadata,
}: AnalysisVideoPlayerProps) {
  const playerRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setDuration(0);
    setIsPlaying(false);
    setIsReady(false);
    setHasError(false);
  }, [src]);

  useEffect(() => {
    if (!disabled) return;
    videoRef.current?.pause();
  }, [disabled, videoRef]);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video || disabled || hasError) return;
    if (video.paused || video.ended) {
      try {
        await video.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }
    video.pause();
  };

  const handleVideoKeyDown = (event: KeyboardEvent<HTMLVideoElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    void togglePlayback();
  };

  const handleSeek = (nextSeconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(nextSeconds)) return;
    video.currentTime = nextSeconds;
    onTimeChange(nextSeconds * 1000);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const enterFullscreen = async () => {
    const player = playerRef.current;
    const video = videoRef.current as IOSVideoElement | null;
    if (!video) return;
    if (player?.requestFullscreen) {
      await player.requestFullscreen().catch(() => undefined);
      return;
    }
    video.webkitEnterFullscreen?.();
  };

  const currentSeconds = Math.min(duration || Number.POSITIVE_INFINITY, Math.max(0, currentTimeMs / 1000));
  const controlsDisabled = disabled || hasError || !isReady;

  return (
    <div ref={playerRef} className="min-w-0 overflow-hidden rounded-xl border border-border bg-black fullscreen:flex fullscreen:h-screen fullscreen:w-screen fullscreen:flex-col fullscreen:rounded-none fullscreen:border-0">
      <div ref={mediaRef} className="relative min-w-0 bg-black fullscreen:flex fullscreen:min-h-0 fullscreen:flex-1 fullscreen:items-center fullscreen:justify-center">
        <video
          ref={videoRef}
          key={src}
          className={cn(
            "block w-full max-h-[46vh] cursor-pointer object-contain transition md:max-h-[50vh] xl:max-h-[52vh] fullscreen:h-full fullscreen:max-h-none",
            disabled ? "pointer-events-none opacity-0" : "opacity-100",
          )}
          playsInline
          preload="metadata"
          disablePictureInPicture
          controlsList="nodownload noplaybackrate noremoteplayback"
          src={src}
          tabIndex={disabled ? -1 : 0}
          aria-label={isPlaying ? "분석 영상 일시정지" : "분석 영상 재생"}
          aria-hidden={disabled}
          onClick={() => void togglePlayback()}
          onKeyDown={handleVideoKeyDown}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={(event) => onTimeChange(event.currentTarget.currentTime * 1000)}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setDuration(Number.isFinite(video.duration) ? video.duration : 0);
            setIsMuted(video.muted);
            setIsReady(true);
            setHasError(false);
            onTimeChange(video.currentTime * 1000);
            onLoadedMetadata?.(video);
          }}
          onError={() => {
            setHasError(true);
            setIsReady(false);
            setIsPlaying(false);
          }}
        >
          브라우저에서 video 태그를 지원하지 않습니다.
        </video>

        {children}

        {!isReady && !hasError && !disabled ? (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white/80 backdrop-blur">
            영상 준비 중
          </span>
        ) : null}
        {hasError ? (
          <div className="absolute inset-x-3 bottom-3 rounded-lg border border-red-300/30 bg-black/80 px-3 py-2 text-sm text-red-100 backdrop-blur">
            영상을 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.
          </div>
        ) : null}
      </div>

      <div className="flex min-h-14 items-center gap-1.5 border-t border-white/10 bg-zinc-950 px-2 py-1.5 sm:gap-2 sm:px-3">
        <ControlButton
          label={isPlaying ? "일시정지" : "재생"}
          disabled={controlsDisabled}
          onClick={() => void togglePlayback()}
        >
          {isPlaying ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
        </ControlButton>

        <span className="w-[72px] shrink-0 text-center text-[11px] font-medium tabular-nums text-white/75 sm:w-[86px] sm:text-xs">
          {formatTime(currentSeconds)} / {formatTime(duration)}
        </span>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={duration ? currentSeconds : 0}
          disabled={controlsDisabled || duration <= 0}
          onChange={(event) => handleSeek(Number(event.currentTarget.value))}
          aria-label="영상 재생 위치"
          className="h-11 min-w-0 flex-1 cursor-pointer bg-transparent accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        />

        <ControlButton label={isMuted ? "음소거 해제" : "음소거"} disabled={disabled || hasError} onClick={toggleMute}>
          {isMuted ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
        </ControlButton>
        <ControlButton label="전체 화면" disabled={disabled || hasError} onClick={() => void enterFullscreen()}>
          <Maximize2 className="size-4" aria-hidden="true" />
        </ControlButton>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-lg text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const rounded = Math.floor(seconds);
  const minutes = Math.floor(rounded / 60);
  return `${minutes}:${String(rounded % 60).padStart(2, "0")}`;
}
