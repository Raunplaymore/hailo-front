import { useEffect, useMemo, useRef, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnalysisOverlay, AnalysisResult, SwingEventKey } from "../../types/shots";
import { AnalysisVideoPlayer } from "./AnalysisVideoPlayer";

type AnalysisPlayerProps = {
  videoUrl?: string;
  events?: AnalysisResult["events"];
  overlay?: AnalysisOverlay | null;
  isModalOpen?: boolean;
};

const EVENT_LABELS: Record<SwingEventKey, string> = {
  address: "Address",
  top: "Top",
  impact: "Impact",
  finish: "Finish",
};

const SKELETON_LINKS = [
  ["left_shoulder", "right_shoulder"], ["left_shoulder", "left_elbow"], ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"], ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"], ["left_hip", "right_hip"], ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"], ["right_hip", "right_knee"], ["right_knee", "right_ankle"],
] as const;

type OverlayBounds = { left: number; top: number; width: number; height: number };
type HandTrailPoint = { timeMs: number; x: number; y: number };

const HAND_TRAIL_DURATION_MS = 800;
const HAND_TRAIL_MAX_GAP_MS = 120;
const LEFT_JOINT_COLOR = "#38bdf8";
const RIGHT_JOINT_COLOR = "#f59e0b";
const CENTER_JOINT_COLOR = "#ecfdf5";

export function AnalysisPlayer({ videoUrl, events, overlay, isModalOpen }: AnalysisPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoFrameRef = useRef<HTMLDivElement | null>(null);
  const [timeMs, setTimeMs] = useState(0);
  const [layers, setLayers] = useState({ pose: true, hands: true, club: true, events: true });
  const [overlayBounds, setOverlayBounds] = useState<OverlayBounds | null>(null);
  const activePose = useMemo(() => nearestAt(overlay?.poseFrames ?? [], timeMs), [overlay, timeMs]);
  const visiblePose = useMemo(() => (overlay?.poseFrames ?? []).filter((frame) => frame.timeMs <= timeMs), [overlay, timeMs]);
  const visibleClub = useMemo(() => (overlay?.clubFrames ?? []).filter((frame) => frame.timeMs <= timeMs), [overlay, timeMs]);

  const syncOverlayBounds = () => {
    const video = videoRef.current;
    const frame = videoFrameRef.current;
    if (!video || !frame || !video.videoWidth || !video.videoHeight) return;

    const width = frame.clientWidth;
    const height = frame.clientHeight;
    if (!width || !height) return;

    const videoAspect = video.videoWidth / video.videoHeight;
    const frameAspect = width / height;
    const contentWidth = videoAspect > frameAspect ? width : height * videoAspect;
    const contentHeight = videoAspect > frameAspect ? width / videoAspect : height;
    const next = {
      left: (width - contentWidth) / 2,
      top: (height - contentHeight) / 2,
      width: contentWidth,
      height: contentHeight,
    };

    setOverlayBounds((current) => current
      && Math.abs(current.left - next.left) < 0.5
      && Math.abs(current.top - next.top) < 0.5
      && Math.abs(current.width - next.width) < 0.5
      && Math.abs(current.height - next.height) < 0.5
      ? current
      : next);
  };

  useEffect(() => {
    const frame = videoFrameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(syncOverlayBounds);
    observer.observe(frame);
    syncOverlayBounds();
    return () => observer.disconnect();
  }, [videoUrl]);

  const handleSeek = (key: SwingEventKey) => {
    const timeMs = events?.[key]?.timeMs;
    if (timeMs == null) return;

    const video = videoRef.current;
    if (!video) return;

    const seekTo = timeMs / 1000;
    const apply = () => {
      video.currentTime = seekTo;
      setTimeMs(timeMs);
    };

    if (video.readyState < 1) {
      const onLoaded = () => {
        apply();
        video.removeEventListener("loadedmetadata", onLoaded);
      };
      video.addEventListener("loadedmetadata", onLoaded);
      video.load();
    } else {
      apply();
    }
  };

  return (
    <Card className="min-w-0">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg">분석 영상</CardTitle>
            <CardDescription className="text-xs">DTL 단일 카메라 기준</CardDescription>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">DTL 기준</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {videoUrl ? (
          <AnalysisVideoPlayer
            src={videoUrl}
            videoRef={videoRef}
            mediaRef={videoFrameRef}
            currentTimeMs={timeMs}
            disabled={isModalOpen}
            onTimeChange={setTimeMs}
            onLoadedMetadata={syncOverlayBounds}
          >
            {overlay && overlayBounds ? (
              <div className="pointer-events-none absolute" style={overlayBounds}>
                <OverlaySvg pose={activePose} poseFrames={visiblePose} clubFrames={visibleClub} events={events} timeMs={timeMs} layers={layers} />
              </div>
            ) : null}
            {overlay ? (
              <details className="absolute right-2 top-2 z-10">
                <summary className="cursor-pointer list-none rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-xs font-semibold text-white backdrop-blur [&::-webkit-details-marker]:hidden">레이어</summary>
                <div className="mt-1 grid gap-1 rounded-lg border border-white/15 bg-black/80 p-1.5 backdrop-blur">
                  {([['pose', '자세'], ['hands', '손'], ['club', '클럽'], ['events', '이벤트']] as const).map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={layers[key]} onClick={() => setLayers((current) => ({ ...current, [key]: !current[key] }))}
                      className={cn("min-h-9 rounded-md px-2 text-left text-xs font-semibold", layers[key] ? "bg-primary text-primary-foreground" : "text-white/75")}>{label}</button>
                  ))}
                </div>
              </details>
            ) : null}
          </AnalysisVideoPlayer>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            선택된 영상이 없습니다. 업로드 후 분석 탭에서 확인하세요.
          </div>
        )}

        {overlay ? (
          <p className="flex items-center gap-3 text-xs text-muted-foreground" aria-label="자세 관절 색상 안내: 왼쪽은 파랑, 오른쪽은 주황">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue-400" aria-hidden="true" />왼쪽 관절</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" aria-hidden="true" />오른쪽 관절</span>
          </p>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">스윙 이벤트 타임라인</p>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            {(Object.keys(EVENT_LABELS) as SwingEventKey[]).map((key) => {
              const event = events?.[key];
              const disabled = !event;
              const isReference = event?.quality === "reference";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSeek(key)}
                  disabled={disabled}
                  className={cn(
                    "min-h-16 min-w-0 w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                    disabled
                      ? "cursor-not-allowed border-border bg-muted/60 text-muted-foreground"
                      : isReference
                        ? "border-amber-300/35 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15"
                        : "border-sky-300/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/15"
                  )}
                >
                  <span className="block text-xs text-muted-foreground">{EVENT_LABELS[key]}</span>
                  <span className="text-sm">
                    {event ? `${Math.round(event.timeMs)} ms${isReference ? " · 참고" : ""}` : "-"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function nearestAt<T extends { timeMs: number }>(frames: T[], timeMs: number): T | undefined {
  return frames.reduce<T | undefined>((best, frame) => !best || Math.abs(frame.timeMs - timeMs) < Math.abs(best.timeMs - timeMs) ? frame : best, undefined);
}

function OverlaySvg({ pose, poseFrames, clubFrames, events, timeMs, layers }: { pose?: AnalysisOverlay["poseFrames"][number]; poseFrames: AnalysisOverlay["poseFrames"]; clubFrames: AnalysisOverlay["clubFrames"]; events?: AnalysisResult["events"]; timeMs: number; layers: Record<"pose" | "hands" | "club" | "events", boolean> }) {
  const hands = pose ? [pose.keypoints.left_wrist, pose.keypoints.right_wrist].filter((point): point is [number, number, number?] => Array.isArray(point) && (point[2] ?? 1) >= .15) : [];
  const latestClub = clubFrames.at(-1);
  const currentEvent = Object.entries(events ?? {}).find(([, event]) => event && Math.abs(event.timeMs - timeMs) < 80)?.[0];
  return <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="block h-full w-full" aria-label="분석 오버레이">
    {layers.club && clubFrames.length > 1 ? <polyline points={clubFrames.filter((frame) => frame.head).map((frame) => `${frame.head!.x},${frame.head!.y}`).join(" ")} fill="none" stroke="#38bdf8" strokeWidth="0.007" /> : null}
    {layers.club && clubFrames.length > 1 ? <polyline points={clubFrames.filter((frame) => frame.handle).map((frame) => `${frame.handle!.x},${frame.handle!.y}`).join(" ")} fill="none" stroke="#fbbf24" strokeWidth="0.006" strokeDasharray="0.014 0.01" /> : null}
    {layers.club && latestClub?.head && latestClub.handle ? <line x1={latestClub.head.x} y1={latestClub.head.y} x2={latestClub.handle.x} y2={latestClub.handle.y} stroke="#fbbf24" strokeWidth="0.009" /> : null}
    {layers.pose && pose ? SKELETON_LINKS.map(([from, to]) => { const a = pose.keypoints[from]; const b = pose.keypoints[to]; return Array.isArray(a) && Array.isArray(b) ? <line key={`${from}-${to}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#34d399" strokeWidth="0.006" /> : null; }) : null}
    {layers.pose && pose ? Object.entries(pose.keypoints).map(([name, point]) => Array.isArray(point) && (point[2] ?? 1) >= .15 ? <circle key={name} cx={point[0]} cy={point[1]} r="0.012" fill={jointColor(name)} /> : null) : null}
    {layers.hands ? (["left_wrist", "right_wrist"] as const).map((key) => {
      const trail = handTrailSegments(poseFrames, key, timeMs);
      return <g key={key} fill="none" stroke="#fb7185" strokeLinecap="round">
        {trail.map(({ from, to }) => {
          const fade = Math.max(.08, 1 - (timeMs - to.timeMs) / HAND_TRAIL_DURATION_MS);
          return <line key={`${from.timeMs}-${to.timeMs}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} strokeWidth={.002 + fade * .004} opacity={.08 + fade * .82} />;
        })}
      </g>;
    }) : null}
    {layers.hands && hands.length ? <g>{hands.map((point, index) => <circle key={index} cx={point[0]} cy={point[1]} r="0.015" fill="#fff1f2" stroke="#fb7185" strokeWidth="0.004" />)}</g> : null}
    {layers.events && currentEvent ? <text x="0.03" y="0.07" fill="white" fontSize="0.045" fontWeight="700">{EVENT_LABELS[currentEvent as SwingEventKey]}</text> : null}
  </svg>;
}

function jointColor(name: string) {
  if (name.startsWith("left_")) return LEFT_JOINT_COLOR;
  if (name.startsWith("right_")) return RIGHT_JOINT_COLOR;
  return CENTER_JOINT_COLOR;
}

function handTrailSegments(poseFrames: AnalysisOverlay["poseFrames"], key: "left_wrist" | "right_wrist", timeMs: number) {
  const points: HandTrailPoint[] = poseFrames
    .filter((frame) => frame.timeMs >= timeMs - HAND_TRAIL_DURATION_MS && frame.timeMs <= timeMs)
    .flatMap((frame) => {
      const point = frame.keypoints[key];
      return Array.isArray(point) && (point[2] ?? 1) >= .15 ? [{ timeMs: frame.timeMs, x: point[0], y: point[1] }] : [];
    });

  return points.slice(1).flatMap((to, index) => {
    const from = points[index];
    return to.timeMs - from.timeMs <= HAND_TRAIL_MAX_GAP_MS ? [{ from, to }] : [];
  });
}
