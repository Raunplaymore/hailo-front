import { ClubObservation } from "./ClubObservation";
import { MovementGuideControls, MovementGuideOverlay } from "./MovementGuide";
import type { GuideKind } from "@/api/movementGuide";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnalysisOverlay, AnalysisResult, DtlClubPointsV2Sidecar, SwingEventKey } from "../../types/shots";
import { withImpactCandidate } from "@/api/impactReview";
import { useImpactReview } from "@/hooks/useImpactReview";
import { API_BASE } from "@/api/client";
import { ImpactReview } from "./ImpactReview";
import { CoachingReview, PelvisContourOverlay } from "./CoachingReview";
import { CoachingLesson } from "./CoachingLesson";
import type { CoachingReview as CoachingResult, CoachingEvidence } from "@/api/coachingReview";
import { AnalysisVideoPlayer } from "./AnalysisVideoPlayer";

type AnalysisPlayerProps = {
  videoUrl?: string;
  jobId?: string;
  events?: AnalysisResult["events"];
  overlay?: AnalysisOverlay | null;
  dtlClubPointsV2?: DtlClubPointsV2Sidecar | null;
  isModalOpen?: boolean;
  evidenceFocus?: { event: SwingEventKey; requestId: number } | null;
};

const EVENT_LABELS: Record<SwingEventKey, string> = {
  address: "준비",
  takeaway: "백스윙",
  top: "탑",
  impact: "임팩트",
  finish: "피니시",
};

const SKELETON_LINKS = [
  ["left_shoulder", "right_shoulder"], ["left_shoulder", "left_elbow"], ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"], ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"], ["left_hip", "right_hip"], ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"], ["right_hip", "right_knee"], ["right_knee", "right_ankle"],
] as const;

type OverlayBounds = { left: number; top: number; width: number; height: number };
type HandTrailPoint = { timeMs: number; x: number; y: number };
type ClubTrailPoint = HandTrailPoint;

const HAND_TRAIL_DURATION_MS = 800;
const HAND_TRAIL_MAX_GAP_MS = 120;
const CLUB_TRAIL_DURATION_MS = 550;
const CLUB_TRAIL_MAX_GAP_MS = 120;
const CLUB_TRAIL_MIN_CONFIDENCE = 0.3;
const LEFT_JOINT_COLOR = "#38bdf8";
const RIGHT_JOINT_COLOR = "#f59e0b";
const CENTER_JOINT_COLOR = "#ecfdf5";

export function AnalysisPlayer({ videoUrl, jobId, events, overlay, dtlClubPointsV2, isModalOpen, evidenceFocus }: AnalysisPlayerProps) {
  const [originalQuality, setOriginalQuality] = useState(false);
  const [tool, setTool] = useState<"coaching" | "impact" | "club">("coaching");
  const impactState = useImpactReview(jobId);
  const displayEvents = withImpactCandidate(events, impactState.review, Boolean(jobId));
  const candidateVideoHash = impactState.review?.videoSha256;
  const reviewVideoUrl = jobId ? `${API_BASE}/api/analyze/${encodeURIComponent(jobId)}/review-video${originalQuality ? "?quality=original" : ""}` : videoUrl;
  const [coaching, setCoaching] = useState<{key:string; result:CoachingResult|null}>({key:"",result:null});
  const [reviewRange, setReviewRange] = useState<{ startMs: number; endMs: number } | null>(null);
  const [guideKind, setGuideKind] = useState<GuideKind | null>(null);
  const guideKey = `${jobId}:${candidateVideoHash ?? "pending"}`;
  const onCoaching = useCallback((result: CoachingResult | null) => setCoaching({key:guideKey,result}),[guideKey]);
  const coachingResult = coaching.key === guideKey ? coaching.result : null;
  const movementGuide = coachingResult?.movementGuide ?? null;
  const contour = tool === "coaching" && !guideKind ? coachingResult?.evidence : null;
  const clearReview = useCallback(() => setReviewRange(null), []);
  useEffect(() => { setGuideKind(null); setReviewRange(null); }, [guideKey]);
  useEffect(() => { setTool("coaching"); setOriginalQuality(false); }, [jobId, videoUrl]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const analysisScrollRef = useRef<HTMLDivElement | null>(null);
  const videoFrameRef = useRef<HTMLDivElement | null>(null);
  const [timeMs, setTimeMs] = useState(0);
  const [clubOverride, setClubOverride] = useState<{ jobId: string; value: DtlClubPointsV2Sidecar } | null>(null);
  const clubSidecar = clubOverride && clubOverride.jobId === jobId ? clubOverride.value : dtlClubPointsV2;
  const [videoPlayable, setVideoPlayable] = useState(false);
  const [layers, setLayers] = useState({ pose: true, hands: true, club: true, events: true });
  const [overlayBounds, setOverlayBounds] = useState<OverlayBounds | null>(null);
  const activePose = useMemo(() => nearestAt(overlay?.poseFrames ?? [], timeMs), [overlay, timeMs]);
  const visiblePose = useMemo(() => (overlay?.poseFrames ?? []).filter((frame) => frame.timeMs <= timeMs && frame.timeMs >= timeMs - HAND_TRAIL_DURATION_MS), [overlay, timeMs]);
  const clubOverlay = clubSidecar?.status === "succeeded" && clubSidecar.overlay?.clubTimeSource === "video_pts"
    ? clubSidecar.overlay : overlay;
  const visibleClub = useMemo(() => (clubOverlay?.clubFrames ?? []).filter((frame) => (
    frame.timeMs <= timeMs && frame.timeMs >= timeMs - CLUB_TRAIL_DURATION_MS
  )), [clubOverlay, timeMs]);

  useEffect(() => {
    const video = videoRef.current;
    const sync = () => setVideoPlayable(Boolean(video && !video.error && !video.seeking && video.readyState >= 2));
    setVideoPlayable(false);
    if (!video) return;
    const events = ["loadeddata", "canplay", "seeking", "seeked", "error", "emptied"];
    events.forEach((name) => video.addEventListener(name, sync));
    sync();
    return () => events.forEach((name) => video.removeEventListener(name, sync));
  }, [reviewVideoUrl]);

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

  const seekTime = (nextMs: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(nextMs) || nextMs < 0) return;
    setReviewRange(null);
    video.pause();
    const apply = () => {
      // Seek inside the frame so rounded PTS does not display the preceding frame.
      video.currentTime = Math.min((nextMs + 0.1) / 1000, video.duration || nextMs / 1000);
      setTimeMs(video.currentTime * 1000);
    };
    if (video.readyState < 1) video.addEventListener("loadedmetadata", apply, { once: true });
    else apply();
  };

  const showEvidence = (evidence: CoachingEvidence) => {
    setGuideKind(null);
    setReviewRange({ startMs: evidence.startMs, endMs: evidence.endMs });
  };

  const handleSeek = (key: SwingEventKey) => {
    const target = displayEvents?.[key]?.timeMs;
    if (target != null) seekTime(target);
  };

  useEffect(() => {
    if (!evidenceFocus) return;
    // Historical coach evidence stays on its historical timing.
    const target = events?.[evidenceFocus.event]?.timeMs;
    if (target != null) seekTime(target);
  }, [evidenceFocus?.requestId]);


  return (
    <Card className="min-w-0 border-0 bg-transparent shadow-none">
      <CardContent className="analysis-workspace p-0">
        <div className="analysis-media min-w-0">
        {videoUrl ? (
          <AnalysisVideoPlayer
            src={reviewVideoUrl!}
            videoRef={videoRef}
            mediaRef={videoFrameRef}
            currentTimeMs={timeMs}
            disabled={isModalOpen}
            onTimeChange={setTimeMs}
            onLoadedMetadata={syncOverlayBounds}
            frameTimes={clubOverlay?.clubFrames.map(frame => frame.timeMs)}
            reviewRange={reviewRange}
            onClearReview={clearReview}
          >
            {(overlay || clubOverlay) && videoPlayable && overlayBounds ? (
              <div className="pointer-events-none absolute" style={overlayBounds}>
                <OverlaySvg pose={activePose} poseFrames={visiblePose} clubFrames={visibleClub} events={displayEvents} timeMs={timeMs} layers={contour || (guideKind && movementGuide?.tracks?.[guideKind]) ? { ...layers, pose: false, hands: false, events: false } : layers} />
              </div>
            ) : null}
            {movementGuide?.status === "ready" && guideKind && videoPlayable && overlayBounds ? <div className="pointer-events-none absolute" style={overlayBounds}><MovementGuideOverlay guide={movementGuide} kind={guideKind} timeMs={timeMs} /></div> : null}
            {contour && videoPlayable && overlayBounds && <div className="pointer-events-none absolute" style={overlayBounds}><PelvisContourOverlay evidence={contour} timeMs={timeMs} /></div>}
            <details className="absolute right-2 top-2 z-10">
              <summary className="cursor-pointer list-none rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-xs font-semibold text-white [&::-webkit-details-marker]:hidden">영상 옵션</summary>
              <div className="mt-1 grid max-h-[25vh] gap-1 overflow-y-auto rounded-lg border border-white/15 bg-black/95 p-1.5">
                <button type="button" aria-pressed={originalQuality} onClick={() => { clearReview(); setOriginalQuality(value => !value); }} className="min-h-12 rounded-md px-3 text-left text-xs text-white">{originalQuality ? "빠른 재생으로 전환" : "원본 화질로 전환"}</button>
                {overlay && ([['pose', '자세'], ['hands', '손'], ['club', '클럽'], ['events', '이벤트']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={layers[key]} onClick={() => { setGuideKind(null); setLayers(current => ({ ...current, [key]: !current[key] })); }} className={cn("min-h-12 rounded-md px-3 text-left text-xs font-semibold", layers[key] ? "bg-primary text-primary-foreground" : "text-white/75")}>{label}</button>)}
              </div>
            </details>
          </AnalysisVideoPlayer>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            확인할 영상이 없습니다. 기록에서 영상을 선택해 주세요.
          </div>
        )}

        </div>
        <div className="analysis-tools min-w-0">
        {jobId && videoUrl && !isModalOpen && <div className="grid shrink-0 grid-cols-3 border-b border-border" role="group" aria-label="영상 확인 도구">
          {([["coaching", "몸"], ["club", "클럽"], ["impact", "임팩트"]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={tool === key} onClick={() => { setTool(key); clearReview(); setGuideKind(null); if (analysisScrollRef.current) analysisScrollRef.current.scrollTop = 0; }} className={cn("min-h-11 border-b-2 px-2 text-sm font-semibold", tool === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</button>)}
        </div>}
        <div ref={analysisScrollRef} className="analysis-scroll space-y-3" role="region" aria-label="분석 내용" tabIndex={0}>
        {contour ? <p className="text-xs text-muted-foreground">노란 점선: 준비 자세 · 초록 선: 추적된 뒤쪽 윤곽 · 추정 공 방향: {contour.ballDirection === "right" ? "오른쪽" : "왼쪽"}</p> : guideKind ? <p className="text-xs text-muted-foreground">점선: 시작 기준 · 실선과 점: 현재 추적 위치</p> : overlay && tool !== "club" ? (
          <p className="flex items-center gap-3 text-xs text-muted-foreground" aria-label="자세 관절 색상 안내: 왼쪽은 파랑, 오른쪽은 주황">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue-400" aria-hidden="true" />왼쪽 관절</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" aria-hidden="true" />오른쪽 관절</span>
          </p>
        ) : null}

        {jobId && videoUrl && !isModalOpen && <>
          <div hidden={tool !== "coaching"}>
            <CoachingReview key={`coaching:${guideKey}`} jobId={jobId} videoSha256={candidateVideoHash} addressMs={Math.max(100, events?.address?.timeMs ?? 200)} impactMs={impactState.review?.candidate.timeMs} candidatePending={impactState.loading} playable={videoPlayable} onResult={onCoaching} onEvidence={showEvidence} onSeek={seekTime} />
          </div>
          {tool === "coaching" && <details><summary className="text-sm font-semibold">머리·골반 움직임 직접 확인</summary><MovementGuideControls playable={videoPlayable} timeMs={timeMs} guide={movementGuide} active={guideKind} onActive={setGuideKind} onSeek={seekTime} /><CoachingLesson topic={guideKind === "pelvis" ? "pelvis" : "head"} /></details>}
          {tool === "impact" && <ImpactReview key={`${jobId}:${candidateVideoHash ?? "pending"}`} review={impactState.review} loading={impactState.loading} playable={videoPlayable} error={impactState.error} onRetry={impactState.retry} timeMs={timeMs} onSeek={seekTime} />}
        </>}

        {jobId && <div hidden={tool !== "club"}><ClubObservation key={jobId} jobId={jobId} sidecar={clubSidecar} onSeek={seekTime} onResult={value => setClubOverride({ jobId, value })} /></div>}
        {tool === "club" && clubSidecar && <details className="text-xs text-muted-foreground"><summary>클럽 추적 근거 · 연구용</summary><ClubTrackingEvidence sidecar={clubSidecar} /></details>}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">스윙 장면 · {jobId ? "임팩트는 추정 후보, 나머지는 연구 참고" : "연구 참고"}</p>
          <div className="grid min-w-0 grid-cols-5 gap-1">
            {(Object.keys(EVENT_LABELS) as SwingEventKey[]).map((key) => {
              const event = displayEvents?.[key];
              const disabled = !event || !videoPlayable;
              const isReference = event?.quality === "reference";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSeek(key)}
                  disabled={disabled}
                  className={cn(
                    "min-h-16 min-w-0 w-full rounded-lg border px-1 py-2 text-center text-xs font-semibold transition",
                    disabled
                      ? "cursor-not-allowed border-border bg-muted/60 text-muted-foreground"
                      : isReference
                        ? "border-amber-300/35 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15"
                        : "border-sky-300/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/15"
                  )}
                >
                  <span className="block text-xs text-muted-foreground">{EVENT_LABELS[key]}</span>
                  <span className="text-[11px]">
                    {event ? `${(event.timeMs / 1000).toFixed(2)}초` : key === "impact" && jobId ? (impactState.loading ? "계산 중" : "판정 보류") : "-"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {jobId && events?.impact ? <details className="text-xs text-muted-foreground">
          <summary className="min-h-11 cursor-pointer">기존 임팩트 기록 · 연구용</summary>
          <p>{Math.round(events.impact.timeMs)} ms · 현재 Impact 선택에 사용하지 않습니다.</p>
        </details> : null}
        </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClubTrackingEvidence({ sidecar }: { sidecar?: DtlClubPointsV2Sidecar | null }) {
  if (!sidecar) return null;
  const isComplete = sidecar.status === "succeeded";
  const isFailed = sidecar.status === "failed";

  return (
    <section className="rounded-xl border border-cyan-300/25 bg-cyan-400/[0.07] px-3 py-2.5" aria-label="DTL V2 클럽 추적 근거">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-cyan-100">DTL V2 클럽 추적</p>
          <p className="mt-0.5 text-[11px] leading-4 text-cyan-100/70">{sidecar.overlay?.clubTimeSource === "video_pts" ? "영상에 파란 헤드 궤적과 노란 그립·샤프트 선을 표시합니다. 헤드와 그립이 함께 확인된 장면에만 샤프트 선이 나타납니다." : "클럽 관측 결과입니다. 이 기록에는 영상 시각과 맞춘 궤적이 아직 없습니다."}</p>
        </div>
        <span className={cn(
          "rounded-full border px-2 py-1 text-[11px] font-semibold",
          isComplete ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" : isFailed ? "border-red-300/40 bg-red-400/10 text-red-100" : "border-cyan-300/35 text-cyan-100",
        )}>
          {isComplete ? "완료" : isFailed ? "실패" : sidecar.status === "running" ? "분석 중" : "대기"}
        </span>
      </div>
      {isComplete ? (
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <EvidenceValue label="Head" value={`${sidecar.trackingQuality?.clubHeadFrames ?? "-"}F`} />
          <EvidenceValue label="Handle" value={`${sidecar.trackingQuality?.clubHandleFrames ?? "-"}F`} />
          <EvidenceValue label="V2 Takeaway" value={sidecar.takeaway?.timeMs == null ? "-" : `${Math.round(sidecar.takeaway.timeMs)} ms`} />
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-cyan-100/80">
          {isFailed ? "V2 보조 추적을 완료하지 못했습니다." : "클럽 head·handle 보조 추적을 백그라운드에서 처리하고 있습니다."}
        </p>
      )}
    </section>
  );
}

function EvidenceValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-cyan-300/15 bg-black/10 px-2 py-1.5">
      <p className="truncate text-[10px] text-cyan-100/65">{label}</p>
      <p className="truncate text-sm font-semibold text-cyan-50">{value}</p>
    </div>
  );
}

function nearestAt<T extends { timeMs: number }>(frames: T[], timeMs: number): T | undefined {
  return frames.reduce<T | undefined>((best, frame) => !best || Math.abs(frame.timeMs - timeMs) < Math.abs(best.timeMs - timeMs) ? frame : best, undefined);
}

function OverlaySvg({ pose, poseFrames, clubFrames, events, timeMs, layers }: { pose?: AnalysisOverlay["poseFrames"][number]; poseFrames: AnalysisOverlay["poseFrames"]; clubFrames: AnalysisOverlay["clubFrames"]; events?: AnalysisResult["events"]; timeMs: number; layers: Record<"pose" | "hands" | "club" | "events", boolean> }) {
  const hands = pose ? [pose.keypoints.left_wrist, pose.keypoints.right_wrist].filter((point): point is [number, number, number?] => Array.isArray(point) && (point[2] ?? 1) >= .15) : [];
  const latestClub = clubFrames.at(-1);
  const visibleShaft = latestClub && timeMs - latestClub.timeMs <= 50
    && [latestClub.head, latestClub.handle].every((point) => point
      && (point.confidence ?? 0) >= CLUB_TRAIL_MIN_CONFIDENCE
      && Number.isFinite(point.x) && Number.isFinite(point.y));
  const headPaths = smoothClubTrailPaths(clubFrames, "head");
  const handlePaths = smoothClubTrailPaths(clubFrames, "handle");
  const currentEvent = Object.entries(events ?? {}).find(([, event]) => event && Math.abs(event.timeMs - timeMs) < 80)?.[0];
  return <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="block h-full w-full" aria-label="분석 오버레이">
    {layers.club ? <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {headPaths.map((path, index) => <g key={`head-${index}`}>
        <path d={path} stroke="#082f49" strokeWidth="0.013" opacity="0.45" />
        <path d={path} stroke="#38bdf8" strokeWidth="0.007" />
      </g>)}
      {handlePaths.map((path, index) => <path key={`handle-${index}`} d={path} stroke="#fbbf24" strokeWidth="0.006" strokeDasharray="0.014 0.01" />)}
    </g> : null}
    {layers.club && visibleShaft && latestClub?.head && latestClub.handle ? <line x1={latestClub.head.x} y1={latestClub.head.y} x2={latestClub.handle.x} y2={latestClub.handle.y} stroke="#fbbf24" strokeWidth="0.009" /> : null}
    {layers.pose && pose ? SKELETON_LINKS.map(([from, to]) => { const a = pose.keypoints[from]; const b = pose.keypoints[to]; return Array.isArray(a) && Array.isArray(b) ? <line key={`${from}-${to}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#34d399" strokeWidth="0.006" /> : null; }) : null}
    {layers.pose && pose ? Object.entries(pose.keypoints).map(([name, point]) => Array.isArray(point) && (point[2] ?? 1) >= .15 ? <circle key={name} cx={point[0]} cy={point[1]} r="0.009" fill={jointColor(name)} /> : null) : null}
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

function smoothClubTrailPaths(clubFrames: AnalysisOverlay["clubFrames"], key: "head" | "handle") {
  const points: ClubTrailPoint[] = clubFrames
    .flatMap((frame) => {
      const point = frame[key];
      return point
        && (point.confidence ?? 1) >= CLUB_TRAIL_MIN_CONFIDENCE
        && Number.isFinite(point.x)
        && Number.isFinite(point.y)
        ? [{ timeMs: frame.timeMs, x: point.x, y: point.y }]
        : [];
    })
    .sort((a, b) => a.timeMs - b.timeMs);

  const segments = points.reduce<ClubTrailPoint[][]>((groups, point) => {
    const current = groups.at(-1);
    if (!current || point.timeMs - current.at(-1)!.timeMs > CLUB_TRAIL_MAX_GAP_MS) {
      groups.push([point]);
    } else {
      current.push(point);
    }
    return groups;
  }, []);

  return segments.filter((segment) => segment.length > 1).map(smoothPathFromPoints);
}

function smoothPathFromPoints(points: ClubTrailPoint[]) {
  const first = points[0];
  if (points.length === 2) return `M ${formatCoordinate(first.x)} ${formatCoordinate(first.y)} L ${formatCoordinate(points[1].x)} ${formatCoordinate(points[1].y)}`;

  const curve = 0.5;
  const segments = [`M ${formatCoordinate(first.x)} ${formatCoordinate(first.y)}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const c1 = {
      x: p1.x + ((p2.x - p0.x) * curve) / 6,
      y: p1.y + ((p2.y - p0.y) * curve) / 6,
    };
    const c2 = {
      x: p2.x - ((p3.x - p1.x) * curve) / 6,
      y: p2.y - ((p3.y - p1.y) * curve) / 6,
    };
    segments.push(`C ${formatCoordinate(c1.x)} ${formatCoordinate(c1.y)}, ${formatCoordinate(c2.x)} ${formatCoordinate(c2.y)}, ${formatCoordinate(p2.x)} ${formatCoordinate(p2.y)}`);
  }
  return segments.join(" ");
}

function formatCoordinate(value: number) {
  return value.toFixed(4);
}
