import {
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Minimize2,
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
  frameTimes?: number[];
  frameTimesSource?: "video" | "tracking";
  disabled?: boolean;
  children?: ReactNode;
  onTimeChange: (timeMs: number) => void;
  onLoadedMetadata?: (video: HTMLVideoElement) => void;
  reviewRange?: { startMs: number; endMs: number } | null;
  onClearReview?: () => void;
  onRetry?: () => void;
};

export function AnalysisVideoPlayer({
  src,
  videoRef,
  mediaRef,
  currentTimeMs,
  frameTimes,
  frameTimesSource = "tracking",
  disabled = false,
  children,
  onTimeChange,
  onLoadedMetadata,
  reviewRange,
  onClearReview,
  onRetry,
}: AnalysisVideoPlayerProps) {
  const playerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [buffering, setBuffering] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !reviewRange || disabled) return;
    const start = reviewRange.startMs / 1000;
    const end = Math.min(reviewRange.endMs / 1000, video.duration);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return;
    let active = true;
    let frame: number | null = null;
    const previousRate = video.playbackRate;
    video.currentTime = start;
    video.playbackRate = .5;
    setPlaybackError(false);
    const loop = () => {
      if (!active) return;
      if (!video.paused && !video.seeking && video.currentTime >= end) video.currentTime = start;
    };
    const nextFrame = () => {
      loop();
      if (active) frame = video.requestVideoFrameCallback(nextFrame);
    };
    if (video.requestVideoFrameCallback) frame = video.requestVideoFrameCallback(nextFrame);
    video.addEventListener("timeupdate", loop);
    void video.play().catch(() => { if (active) setPlaybackError(true); });
    return () => {
      active = false;
      if (frame !== null) video.cancelVideoFrameCallback(frame);
      video.removeEventListener("timeupdate", loop);
      video.pause(); video.playbackRate = previousRate;
    };
  }, [reviewRange, disabled, src, videoRef, onTimeChange]);

  useEffect(() => {
    setDuration(0);
    setScrubTime(null); pendingSeek.current = null; dragging.current = false;
    setIsPlaying(false);
    setIsReady(false);
    setHasFrame(false);
    setHasError(false);
  }, [src]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setIsImmersive(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!disabled) return;
    videoRef.current?.pause();
  }, [disabled, videoRef]);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video || disabled || hasError) return;
    if (video.paused || video.ended) {
      try {
        if (reviewRange && (video.currentTime * 1000 < reviewRange.startMs || video.currentTime * 1000 >= reviewRange.endMs)) video.currentTime = reviewRange.startMs / 1000;
        await video.play();
        setPlaybackError(false);
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
    onClearReview?.();
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
    if (player?.requestFullscreen) {
      await player.requestFullscreen().catch(() => undefined);
      return;
    }
    // iOS Safari's video.webkitEnterFullscreen() omits React overlay children.
    // Keep the whole player in an app-level immersive view instead, so every layer remains visible.
    setIsImmersive(true);
  };

  const currentSeconds = Math.min(duration || Number.POSITIVE_INFINITY, Math.max(0, scrubTime ?? currentTimeMs / 1000));
  const previousFrame = frameTimes?.filter(ms => ms < currentTimeMs - 1).at(-1);
  const nextFrame = frameTimes?.find(ms => ms > currentTimeMs + 1);
  const stepFrame = (ms: number) => { videoRef.current?.pause(); handleSeek((ms + 0.1) / 1000); };
  const controlsDisabled = disabled || hasError || !isReady;

  return (
    <div ref={playerRef} className={cn("min-w-0 overflow-hidden rounded-xl border border-border bg-black fullscreen:flex fullscreen:h-screen fullscreen:w-screen fullscreen:flex-col fullscreen:rounded-none fullscreen:border-0", isImmersive && "analysis-immersive fixed inset-0 z-50 flex h-[100dvh] w-screen flex-col rounded-none border-0") }>
      <div ref={mediaRef} className="relative min-w-0 bg-black fullscreen:flex fullscreen:min-h-0 fullscreen:flex-1 fullscreen:items-center fullscreen:justify-center">
        <video
          ref={videoRef}
          key={src}
          className={cn(
            "block w-full max-h-[32vh] cursor-pointer object-contain transition md:max-h-[50vh] xl:max-h-[52vh] fullscreen:h-full fullscreen:max-h-none",
            disabled ? "pointer-events-none opacity-0" : "opacity-100",
          )}
          playsInline
          preload="auto"
          disablePictureInPicture
          controlsList="nodownload noplaybackrate noremoteplayback"
          src={src}
          tabIndex={disabled ? -1 : 0}
          aria-label={isPlaying ? "분석 영상 일시정지" : "분석 영상 재생"}
          aria-hidden={disabled}
          onClick={() => void togglePlayback()}
          onKeyDown={handleVideoKeyDown}
          onPlay={() => setIsPlaying(true)}
          onPause={(event) => { setIsPlaying(false); onTimeChange(event.currentTarget.currentTime * 1000); }}
          onEnded={() => setIsPlaying(false)}
          onWaiting={() => setBuffering(true)}
          onSeeking={() => setBuffering(true)}
          onSeeked={(event) => { setBuffering(false); onTimeChange(event.currentTarget.currentTime * 1000); }}
          onLoadedData={() => setHasFrame(true)}
          onCanPlay={() => { setBuffering(false); setHasFrame(true); }}
          onPlaying={() => { setBuffering(false); setHasFrame(true); }}
          onTimeUpdate={(event) => onTimeChange(event.currentTarget.currentTime * 1000)}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setDuration(Number.isFinite(video.duration) ? video.duration : 0);
            setIsMuted(video.muted);
            setIsReady(true);
            setHasFrame(video.readyState >= 2);
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
        <div className="absolute bottom-1 left-1 rounded-lg bg-black/60">
          <ControlButton label={isMuted ? "음소거 해제" : "음소거"} disabled={disabled || hasError} onClick={toggleMute}>
            {isMuted ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
          </ControlButton>
        </div>
        <div className="absolute bottom-1 right-1 rounded-lg bg-black/60">
          <ControlButton label={isImmersive ? "전체 화면 닫기" : "전체 화면"} disabled={disabled || hasError} onClick={() => isImmersive ? setIsImmersive(false) : void enterFullscreen()}>
            {isImmersive ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
          </ControlButton>
        </div>

        {(!isReady || buffering || (!hasFrame && !isPlaying)) && !hasError && !disabled ? (
          <span role="status" className="pointer-events-none absolute bottom-14 left-2 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white/80 backdrop-blur">
            {!isReady ? "영상 준비 중" : buffering ? "장면 불러오는 중…" : "재생 버튼을 눌러 영상을 준비해 주세요"}
          </span>
        ) : null}
        {hasError ? (
          <div className="absolute inset-x-3 bottom-3 rounded-lg border border-red-300/30 bg-black/80 px-3 py-2 text-sm text-red-100 backdrop-blur">
            <p>영상을 불러오지 못했습니다. 영상이 변경됐거나 연결에 문제가 있을 수 있습니다.</p>
            <button type="button" className="mt-2 min-h-12 rounded-lg border border-white/30 px-3 text-sm text-white" onClick={() => { setHasError(false); setIsReady(false); setBuffering(false); videoRef.current?.load(); onRetry?.(); }}>영상 다시 불러오기</button>
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/10 bg-zinc-950">
        {reviewRange && <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 text-xs text-emerald-200">
          <span role="status">{playbackError ? "재생 버튼을 눌러 시작하세요" : "근거 구간 · 0.5배 반복"}</span>
          <button type="button" onClick={onClearReview} className="min-h-12 rounded-lg px-2 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">전체 영상 보기</button>
        </div>}
        <div className="flex h-14 items-center gap-1 px-1" aria-label="영상 조작">
          <ControlButton
            label={isPlaying ? "일시정지" : "재생"}
            disabled={controlsDisabled}
            onClick={() => void togglePlayback()}
          >
            {isPlaying ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
          </ControlButton>
          {frameTimes?.length ? <ControlButton label={frameTimesSource === "video" ? "이전 프레임" : "이전 추적 프레임"} disabled={controlsDisabled || previousFrame == null} onClick={() => previousFrame != null && stepFrame(previousFrame)}><ChevronLeft className="size-4" /></ControlButton> : null}
          <div className="relative min-w-0 flex-1 pb-2">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={duration ? currentSeconds : 0}
            disabled={controlsDisabled || duration <= 0}
            onPointerDown={(event) => { onClearReview?.(); event.currentTarget.setPointerCapture(event.pointerId); videoRef.current?.pause(); dragging.current = true; }}
            onPointerUp={() => {
              dragging.current = false;
              if (pendingSeek.current !== null) handleSeek(pendingSeek.current);
              pendingSeek.current = null; setScrubTime(null);
            }}
            onPointerCancel={() => { dragging.current = false; pendingSeek.current = null; setScrubTime(null); }}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              if (dragging.current) { pendingSeek.current = next; setScrubTime(next); }
              else handleSeek(next);
            }}
            aria-label="영상 재생 위치"
            className="block h-11 w-full min-w-0 cursor-pointer bg-transparent accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-[10px] tabular-nums text-white/70">{formatTime(currentSeconds)} / {formatTime(duration)}</span>
          </div>
          {frameTimes?.length ? <ControlButton label={frameTimesSource === "video" ? "다음 프레임" : "다음 추적 프레임"} disabled={controlsDisabled || nextFrame == null} onClick={() => nextFrame != null && stepFrame(nextFrame)}><ChevronRight className="size-4" /></ControlButton> : null}
        </div>
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
