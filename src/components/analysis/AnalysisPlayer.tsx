import { ClubObservation } from "./ClubObservation";
import { MovementGuideControls, MovementGuideOverlay } from "./MovementGuide";
import type { GuideKind, MovementGuide } from "@/api/movementGuide";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnalysisOverlay, AnalysisResult, DtlClubPointsV2Sidecar, SwingEventKey } from "../../types/shots";
import { frameIndexAtOrBefore, frameIndexForPresentedTime, impactReviewVideoUrl, withImpactCandidate } from "@/api/impactReview";
import { useImpactReview } from "@/hooks/useImpactReview";
import { useVideoClock } from "@/hooks/useVideoClock";
import { usePoseOverlay } from "@/hooks/usePoseOverlay";
import { ImpactReview } from "./ImpactReview";
import { CoachingReview, PelvisContourOverlay, type ContourStatus } from "./CoachingReview";
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
// shortcut: render hand trails at roughly 60Hz; retain raw observations for exact timing.
const HAND_TRAIL_MIN_SPACING_MS = 16;
// shortcut: 50ms is a display window, not calibrated pose accuracy; validate against each sampling rate.
const POSE_FRAME_MAX_DISTANCE_MS = 50;
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
  const manualClockState = useVideoClock(jobId, Boolean(impactState.error));
  const videoClock = impactState.review ?? manualClockState.clock;
  const poseState = usePoseOverlay(jobId, videoClock);
  const displayEvents = withImpactCandidate(events, impactState.review, Boolean(jobId));
  const candidateVideoHash = impactState.review?.videoSha256;
  const videoSha256 = videoClock?.videoSha256;
  const reviewVideoUrl = jobId ? impactReviewVideoUrl(jobId, videoSha256, originalQuality) : videoUrl;
  const [impactSelection, setImpactSelection] = useState<{jobId: string; videoSha256: string; frameIndex: number; timeMs: number} | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const selectedImpact = impactSelection && videoClock && impactSelection.jobId === jobId
    && impactSelection.videoSha256 === videoSha256
    && videoClock.frameTimesMs[impactSelection.frameIndex] === impactSelection.timeMs ? impactSelection : null;
  const coachingImpactMs = selectedImpact?.timeMs ?? impactState.review?.candidate.timeMs;
  const addressMs = Math.max(100, events?.address?.timeMs ?? 200);
  const [coaching, setCoaching] = useState<{key:string; result:CoachingResult|null}>({key:"",result:null});
  const [reviewRange, setReviewRange] = useState<{ startMs: number; endMs: number } | null>(null);
  const [guideKind, setGuideKind] = useState<GuideKind | null>(null);
  const guideKey = `${jobId}:${videoSha256 ?? "pending"}:${addressMs}:${selectedImpact ? `selected:${selectedImpact.frameIndex}` : `candidate:${coachingImpactMs}`}`;
  const onCoaching = useCallback((result: CoachingResult | null) => setCoaching({key:guideKey,result}),[guideKey]);
  const coachingResult = coaching.key === guideKey ? coaching.result : null;
  const movementGuide = coachingResult?.movementGuide ?? null;
  const contour = tool === "coaching" && !guideKind ? coachingResult?.evidence : null;
  const pendingContourRetry = useRef<(() => void) | null>(null);
  const clearReview = useCallback(() => { pendingContourRetry.current?.(); pendingContourRetry.current = null; setReviewRange(null); }, []);
  useEffect(() => { setGuideKind(null); clearReview(); }, [guideKey, clearReview]);
  useEffect(() => { setImpactSelection(null); setSelectionError(null); }, [jobId, videoUrl, videoSha256]);
  useEffect(() => { setTool("coaching"); setOriginalQuality(false); }, [jobId, videoUrl]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const presentedFrame = useRef<{video: HTMLVideoElement; src: string; timeMs: number; expectedDisplayTime: number} | null>(null);
  const analysisScrollRef = useRef<HTMLDivElement | null>(null);
  const videoFrameRef = useRef<HTMLDivElement | null>(null);
  const [timeMs, setTimeMs] = useState(0);
  const [clubOverride, setClubOverride] = useState<{ jobId: string; value: DtlClubPointsV2Sidecar } | null>(null);
  const clubSidecar = clubOverride && clubOverride.jobId === jobId ? clubOverride.value : dtlClubPointsV2;
  const poseOverlay = useMemo(() => {
    if (!jobId) return overlay;
    const poseFrames = poseState.pose?.status === "ready" ? poseState.pose.poseFrames : [];
    if (!overlay && !poseFrames.length) return null;
    return {coordinateSpace: "normalized" as const, poseFrames, clubFrames: overlay?.clubFrames ?? [], clubTimeSource: overlay?.clubTimeSource};
  }, [jobId, overlay, poseState.pose]);
  const [videoStatus, setVideoStatus] = useState<{src?: string; ready: boolean}>({ready: false});
  const videoPlayable = videoStatus.src === reviewVideoUrl && videoStatus.ready;
  const [layers, setLayers] = useState({ pose: true, hands: true, club: true, events: true });
  const [overlayBounds, setOverlayBounds] = useState<OverlayBounds | null>(null);
  const [contourStatus, setContourStatus] = useState<ContourStatus>("checking");
  const canRetryContour = Boolean(contour && videoClock && videoRef.current && typeof videoRef.current.requestVideoFrameCallback === "function"
    && videoClock.frameTimesMs.filter(time => Math.abs(time - contour.focusMs) <= 1.1).length === 1);
  const clubVideoUnverified = clubSidecar?.overlayVideoSha256 !== undefined && clubSidecar.overlayVideoSha256 !== candidateVideoHash;
  const clubOverlay = clubSidecar?.overlayVideoSha256 !== undefined
    ? (!clubVideoUnverified && clubSidecar.status === "succeeded" && clubSidecar.pendingOverlay?.clubTimeSource === "video_pts" ? clubSidecar.pendingOverlay : null)
    : clubSidecar?.status === "succeeded" && clubSidecar.overlay?.clubTimeSource === "video_pts" ? clubSidecar.overlay : overlay;
  const clubFrameTimes = useMemo(() => clubOverlay?.clubFrames.map(frame => frame.timeMs), [clubOverlay]);
  const useClubFrameTimes = Boolean(clubFrameTimes?.length && (tool === "club" || !videoClock));

  useEffect(() => {
    return () => { pendingContourRetry.current?.(); pendingContourRetry.current = null; };
  }, [jobId, reviewVideoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    const sync = () => setVideoStatus({src: reviewVideoUrl, ready: Boolean(video && !video.error && !video.seeking && video.readyState >= 2)});
    setVideoStatus({src: reviewVideoUrl, ready: false});
    if (!video) return;
    const events = ["loadeddata", "canplay", "seeking", "seeked", "error", "emptied"];
    events.forEach((name) => video.addEventListener(name, sync));
    sync();
    return () => events.forEach((name) => video.removeEventListener(name, sync));
  }, [reviewVideoUrl, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    presentedFrame.current = null;
    if (!video || !jobId || !reviewVideoUrl || typeof video.requestVideoFrameCallback !== "function") return;
    let active = true, generation = 0, seeking = false, awaitingSeekingEvent = false;
    let callback: number;
    const register = () => {
      const current = generation;
      callback = video.requestVideoFrameCallback((_now, metadata) => {
        if (!active || current !== generation) return;
        if (video.seeking && !seeking) {
          seeking = true; awaitingSeekingEvent = true; clear(); generation++;
        }
        presentedFrame.current = {video, src: reviewVideoUrl, timeMs: metadata.mediaTime * 1000, expectedDisplayTime: metadata.expectedDisplayTime};
        register();
      });
    };
    const clear = () => { presentedFrame.current = null; };
    const onSeeking = () => {
      if (seeking && awaitingSeekingEvent) { awaitingSeekingEvent = false; return; }
      seeking = true; awaitingSeekingEvent = false;
      clear(); generation++; video.cancelVideoFrameCallback?.(callback); register();
    };
    const onSeeked = () => { seeking = false; awaitingSeekingEvent = false; };
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("emptied", clear);
    video.addEventListener("error", clear);
    register();
    return () => {
      active = false;
      video.cancelVideoFrameCallback?.(callback);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("emptied", clear);
      video.removeEventListener("error", clear);
      presentedFrame.current = null;
    };
  }, [jobId, reviewVideoUrl, videoUrl]);

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
    pendingContourRetry.current?.(); pendingContourRetry.current = null;
    setReviewRange(null);
    video.pause();
    const apply = () => {
      const frame = presentedFrame.current;
      if (videoClock && frame?.video === video && frame.src === reviewVideoUrl && frame.expectedDisplayTime <= performance.now()
        && Math.abs(frame.timeMs - nextMs) <= 1.1
        && frameIndexForPresentedTime(videoClock.frameTimesMs, video.currentTime * 1000, frame.timeMs) !== null) {
        setTimeMs(video.currentTime * 1000);
        return;
      }
      // Seek inside the frame so rounded PTS does not display the preceding frame.
      video.currentTime = Math.min((nextMs + 0.1) / 1000, video.duration || nextMs / 1000);
      setTimeMs(video.currentTime * 1000);
    };
    if (video.readyState < 1) video.addEventListener("loadedmetadata", apply, { once: true });
    else apply();
  };

  const retryContour = (targetMs: number) => {
    const video = videoRef.current, clock = videoClock;
    if (!video || !clock || !videoPlayable || !canRetryContour) return;
    const indices = clock.frameTimesMs.flatMap((time, index) => Math.abs(time - targetMs) <= 1.1 ? [index] : []);
    if (indices.length !== 1) return;
    const current = frameIndexAtOrBefore(clock.frameTimesMs, video.currentTime * 1000);
    const neighbor = [indices[0] + 1, indices[0] - 1].find(index => index >= 0 && index < clock.frameTimesMs.length && index !== current);
    if (neighbor === undefined) return;
    pendingContourRetry.current?.();
    setReviewRange(null); video.pause();
    let active = true, animation = 0, timer = 0;
    const stop = () => { active = false; cancelAnimationFrame(animation); clearTimeout(timer); video.removeEventListener("seeked", onSeeked); };
    const fail = () => { if (!active) return; stop(); if (pendingContourRetry.current === stop) pendingContourRetry.current = null; setContourStatus("unverified"); };
    const onSeeked = () => {
      if (!active) return;
      const deadline = performance.now() + 1200;
      const check = () => {
        if (!active) return;
        if (videoRef.current !== video || video.seeking || frameIndexAtOrBefore(clock.frameTimesMs, video.currentTime * 1000) !== neighbor) { stop(); if (pendingContourRetry.current === stop) pendingContourRetry.current = null; return; }
        const frame = presentedFrame.current;
        const index = frame?.video === video && frame.src === reviewVideoUrl && frame.expectedDisplayTime <= performance.now()
          ? frameIndexForPresentedTime(clock.frameTimesMs, video.currentTime * 1000, frame.timeMs) : null;
        if (index === neighbor) { stop(); if (pendingContourRetry.current === stop) pendingContourRetry.current = null; seekTime(targetMs); return; }
        if (performance.now() < deadline) animation = requestAnimationFrame(check); else fail();
      };
      animation = requestAnimationFrame(check);
    };
    pendingContourRetry.current = stop;
    video.addEventListener("seeked", onSeeked, { once: true });
    timer = window.setTimeout(fail, 2500);
    video.currentTime = (clock.frameTimesMs[neighbor] + .1) / 1000;
    setTimeMs(video.currentTime * 1000);
  };

  const chooseImpactAtCurrentTime = () => {
    const video = videoRef.current;
    const clock = videoClock;
    if (!jobId || !clock || !video || !videoPlayable || video.seeking || video.readyState < 2) {
      setSelectionError("영상이 준비된 뒤 다시 선택해 주세요.");
      return;
    }
    if (!video.paused) {
      video.pause();
      setSelectionError("영상을 일시 정지했어요. 타격 장면을 확인하고 다시 선택해 주세요.");
      return;
    }
    const frame = presentedFrame.current;
    // shortcut: matching timestamps do not prove identical decoded images; validate playback on physical devices.
    const index = frame?.video === video && frame.src === reviewVideoUrl && Number.isFinite(frame.expectedDisplayTime)
      && frame.expectedDisplayTime <= performance.now()
      ? frameIndexForPresentedTime(clock.frameTimesMs, video.currentTime * 1000, frame.timeMs) : null;
    if (index === null) {
      setSelectionError(typeof video.requestVideoFrameCallback === "function"
        ? "화면 장면을 확인할 수 없어요. 이전·다음 프레임으로 이동한 뒤 다시 선택해 주세요."
        : "이 브라우저에서는 표시된 장면을 확인할 수 없습니다. 다른 브라우저에서 다시 시도해 주세요.");
      return;
    }
    const chosenMs = clock.frameTimesMs[index];
    if (chosenMs === undefined || chosenMs - addressMs < 230) {
      setSelectionError("준비 자세보다 뒤의 타격 장면을 선택해 주세요.");
      return;
    }
    setImpactSelection({ jobId, videoSha256: clock.videoSha256, frameIndex: index, timeMs: chosenMs });
    setSelectionError(null);
    seekTime(chosenMs);
    setTool("coaching");
    if (analysisScrollRef.current) analysisScrollRef.current.scrollTop = 0;
  };

  const showEvidence = (evidence: CoachingEvidence) => {
    clearReview();
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
            frameTimes={useClubFrameTimes ? clubFrameTimes : videoClock?.frameTimesMs}
            frameTimesSource={useClubFrameTimes ? "tracking" : "video"}
            reviewRange={reviewRange}
            onClearReview={clearReview}
            onRetry={jobId ? (impactState.error ? manualClockState.retry : impactState.retry) : undefined}
          >
            <FrameSyncedOverlays src={reviewVideoUrl!} videoRef={videoRef} timeMs={timeMs} overlay={poseOverlay} clubOverlay={clubOverlay}
              clubFrameClockVerified={Boolean(candidateVideoHash && clubSidecar?.sourceFrameCoverage?.status === "verified" && clubSidecar.overlayVideoSha256 === candidateVideoHash)}
              events={displayEvents} playable={videoPlayable} bounds={overlayBounds} layers={layers} contour={contour} guideKind={guideKind} movementGuide={movementGuide}
              frameTimes={videoClock?.frameTimesMs} presentedFrame={presentedFrame} onContourStatus={setContourStatus} />
            <details className="absolute right-2 top-2 z-10">
              <summary className="cursor-pointer list-none rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-xs font-semibold text-white [&::-webkit-details-marker]:hidden">영상 옵션</summary>
              <div className="mt-1 grid max-h-[25vh] gap-1 overflow-y-auto rounded-lg border border-white/15 bg-black/95 p-1.5">
                {jobId && <button type="button" aria-pressed={originalQuality} onClick={() => { clearReview(); setOriginalQuality(value => !value); }} className="min-h-12 rounded-md px-3 text-left text-xs text-white">{originalQuality ? "빠른 재생으로 전환" : "분석 영상 화질로 전환"}</button>}
                {(poseOverlay || clubOverlay) && ([['pose', '자세'], ['hands', '손'], ['club', '클럽'], ['events', '이벤트']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={layers[key]} onClick={() => { setGuideKind(null); setLayers(current => ({ ...current, [key]: !current[key] })); }} className={cn("min-h-12 rounded-md px-3 text-left text-xs font-semibold", layers[key] ? "bg-primary text-primary-foreground" : "text-white/75")}>{label}</button>)}
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
        {clubVideoUnverified && Boolean(clubSidecar?.pendingOverlay?.clubFrames.length) && <p className="text-xs text-muted-foreground" role="status">클럽 궤적은 임팩트 후보와 영상 일치가 확인되면 표시됩니다.</p>}
        {jobId && tool !== "club" && !contour && !guideKind && (impactState.loading || poseState.loading
          ? <p className="text-xs text-muted-foreground" role="status">자세 선의 영상 시각을 확인하고 있어요.</p>
          : !videoClock || poseState.error || poseState.pose?.status === "unavailable"
            ? <div className="text-xs text-muted-foreground" role="status"><p>영상과 자세 시각을 확인하지 못해 관절 표시를 보류했습니다.</p>
              <button type="button" className="min-h-11 font-semibold underline" onClick={impactState.error ? manualClockState.retry : videoClock ? poseState.retry : impactState.retry}>다시 확인</button></div> : null)}
        {!jobId && Boolean(overlay?.poseFrames.length) && <p className="text-xs text-muted-foreground">자세 선의 영상 시각은 확인되지 않았습니다. 실제 장면과 맞는지 살펴보세요.</p>}
        {contour ? <p className="text-xs text-muted-foreground">노란 점선: 준비 자세 · 초록 선: 추정한 뒤쪽 윤곽 · 추정 공 방향: {contour.ballDirection === "right" ? "오른쪽" : "왼쪽"}</p> : guideKind ? <p className="text-xs text-muted-foreground">점선: 시작 기준 · 실선과 점: 현재 추적 위치</p> : poseOverlay && tool !== "club" ? (
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground" aria-label="자세 관절 색상 안내: 왼쪽은 파랑, 오른쪽은 주황, 가시성이 낮으면 숨김">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue-400" aria-hidden="true" />왼쪽 관절</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" aria-hidden="true" />오른쪽 관절</span>
            <span>낮은 가시성은 숨김</span>
          </p>
        ) : null}

        {jobId && videoUrl && !isModalOpen && <>
          <div hidden={tool !== "coaching"}>
            {selectedImpact && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 p-3" role="status">
              <p className="text-sm">직접 선택한 장면 · {(selectedImpact.timeMs / 1000).toFixed(3)}초 기준</p>
              <button type="button" className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setImpactSelection(null); clearReview(); }}>{impactState.review ? "자동 후보로 되돌리기" : "선택 취소"}</button>
            </div>}
            <CoachingReview key={`coaching:${guideKey}`} jobId={jobId} videoSha256={videoSha256} addressMs={addressMs} impactMs={coachingImpactMs} impactFrameIndex={selectedImpact?.frameIndex} candidatePending={impactState.loading} playable={videoPlayable} contourStatus={contourStatus} canRetryContour={canRetryContour} onResult={onCoaching} onEvidence={showEvidence} onSeek={ms => { setGuideKind(null); seekTime(ms); }} onRetryContour={retryContour} />
          </div>
          {tool === "coaching" && <details><summary className="text-sm font-semibold">머리·골반 움직임 직접 확인</summary><MovementGuideControls playable={videoPlayable} timeMs={timeMs} guide={movementGuide} active={guideKind} onActive={setGuideKind} onSeek={seekTime} selectedImpact={Boolean(selectedImpact)} /><CoachingLesson topic={guideKind === "pelvis" ? "pelvis" : "head"} /></details>}
        {tool === "impact" && <ImpactReview key={`${jobId}:${videoSha256 ?? "pending"}`} review={impactState.review} manualClock={manualClockState.clock} clockLoading={manualClockState.loading} clockError={manualClockState.error} onClockRetry={manualClockState.retry} loading={impactState.loading} playable={videoPlayable} error={impactState.error} onRetry={impactState.retry} timeMs={timeMs} onSeek={seekTime} onChooseCurrent={chooseImpactAtCurrentTime} selectionError={selectionError} />}
        </>}

        {jobId && <div hidden={tool !== "club"}><ClubObservation key={jobId} jobId={jobId} sidecar={clubSidecar} playable={videoPlayable} onSeek={seekTime} onResult={value => setClubOverride({ jobId, value })} /></div>}
        {tool === "club" && clubSidecar && <details className="text-xs text-muted-foreground"><summary>클럽 추적 근거 · 연구용</summary><ClubTrackingEvidence sidecar={clubSidecar} overlay={clubOverlay} /></details>}
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

function FrameSyncedOverlays({ src, videoRef, timeMs, overlay, clubOverlay, clubFrameClockVerified, events, playable, bounds, layers, contour, guideKind, movementGuide, frameTimes, presentedFrame, onContourStatus }: {
  src: string; videoRef: RefObject<HTMLVideoElement | null>; timeMs: number; overlay?: AnalysisOverlay | null; clubOverlay?: AnalysisOverlay | null;
  clubFrameClockVerified?: boolean;
  events?: AnalysisResult["events"]; playable: boolean; bounds: OverlayBounds | null; layers: Record<"pose" | "hands" | "club" | "events", boolean>;
  contour?: CoachingEvidence | null; guideKind: GuideKind | null; movementGuide: MovementGuide | null;
  frameTimes?: number[]; presentedFrame: RefObject<{video: HTMLVideoElement; src: string; timeMs: number; expectedDisplayTime: number} | null>;
  onContourStatus: (status: ContourStatus) => void;
}) {
  const [presented, setPresented] = useState<{ video: HTMLVideoElement; src: string; timeMs: number } | null>(null);
  const [contourFrame, setContourFrame] = useState<{ video: HTMLVideoElement; src: string; timeMs: number } | null>(null);
  const enabled = Boolean(playable && bounds && (overlay || clubOverlay || contour || (guideKind && movementGuide?.status === "ready")));
  useEffect(() => {
    const video = videoRef.current;
    setPresented(null);
    if (!enabled || !video || typeof video.requestVideoFrameCallback !== "function") return;
    let active = true;
    let callback: number;
    const clear = () => setPresented(null);
    const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
      if (!active) return;
      if (!video.seeking && Number.isFinite(metadata.mediaTime)) setPresented({video, src, timeMs: metadata.mediaTime * 1000});
      callback = video.requestVideoFrameCallback(onFrame);
    };
    for (const event of ["pause", "seeking", "emptied", "error"]) video.addEventListener(event, clear);
    callback = video.requestVideoFrameCallback(onFrame);
    return () => {
      active = false;
      video.cancelVideoFrameCallback?.(callback);
      for (const event of ["pause", "seeking", "emptied", "error"]) video.removeEventListener(event, clear);
    };
  }, [enabled, src, videoRef]);
  useEffect(() => {
    const video = videoRef.current;
    setContourFrame(null);
    if (!contour || !video) return;
    if (!frameTimes || typeof video.requestVideoFrameCallback !== "function") { onContourStatus("unverified"); return; }
    let active = true, request = 0, generation = 0;
    const clear = () => { generation++; cancelAnimationFrame(request); setContourFrame(null); onContourStatus(video.paused ? "checking" : "playing"); };
    const observe = () => {
      clear();
      if (!video.paused || video.seeking || video.readyState < 2) return;
      const current = generation, deadline = performance.now() + 1200;
      const check = () => {
        if (!active || generation !== current || !video.paused || video.seeking) return;
        const frame = presentedFrame.current;
        const index = frame?.video === video && frame.src === src && Number.isFinite(frame.expectedDisplayTime)
          && frame.expectedDisplayTime <= performance.now()
          ? frameIndexForPresentedTime(frameTimes, video.currentTime * 1000, frame.timeMs) : null;
        if (index !== null) {
          const time = frameTimes[index];
          const samples = contour.points.filter(point => Math.abs(point.timeMs - time) <= 1.1);
          const sample = samples[0];
          const unique = samples.length === 1
            && (index === 0 || Math.abs(sample.timeMs - frameTimes[index - 1]) > 1.1)
            && (index === frameTimes.length - 1 || Math.abs(sample.timeMs - frameTimes[index + 1]) > 1.1);
          if (unique) { setContourFrame({video, src, timeMs: time}); onContourStatus("shown"); }
          else onContourStatus(samples.length ? "unverified" : "other");
          return;
        }
        if (performance.now() < deadline) request = requestAnimationFrame(check);
        else onContourStatus("unverified");
      };
      request = requestAnimationFrame(check);
    };
    for (const event of ["pause", "seeked", "loadeddata", "canplay"]) video.addEventListener(event, observe);
    for (const event of ["play", "seeking", "emptied", "error"]) video.addEventListener(event, clear);
    observe();
    return () => {
      active = false; generation++; cancelAnimationFrame(request);
      for (const event of ["pause", "seeked", "loadeddata", "canplay"]) video.removeEventListener(event, observe);
      for (const event of ["play", "seeking", "emptied", "error"]) video.removeEventListener(event, clear);
    };
  }, [contour, frameTimes, onContourStatus, presentedFrame, src, videoRef]);
  const hasPresentedFrame = presented?.video === videoRef.current && presented.src === src;
  const clock = hasPresentedFrame ? presented.timeMs : timeMs;
  // shortcut: 1 microsecond covers source-clock rounding; validate again if timestamp precision changes.
  const clubClock = clock + (hasPresentedFrame && clubFrameClockVerified ? .001 : 0);
  const poseFrames = useMemo(() => [...(overlay?.poseFrames ?? [])].sort((a, b) => a.timeMs - b.timeMs), [overlay?.poseFrames]);
  const activePose = useMemo(() => nearestAt(poseFrames, clock), [poseFrames, clock]);
  const visiblePose = useMemo(() => poseFrames.slice(frameBound(poseFrames, clock - HAND_TRAIL_DURATION_MS), frameBound(poseFrames, clock, true)), [poseFrames, clock]);
  const visibleClub = useMemo(() => (clubOverlay?.clubFrames ?? []).filter((frame) => frame.timeMs <= clubClock && frame.timeMs >= clock - CLUB_TRAIL_DURATION_MS), [clubOverlay, clock, clubClock]);
  if (!enabled || !bounds) return null;
  return <div className="pointer-events-none absolute" style={bounds} data-overlay-time-ms={clock}>
    {(overlay || clubOverlay) && <div className="absolute inset-0"><OverlaySvg pose={activePose} poseFrames={visiblePose} clubFrames={visibleClub} events={events} timeMs={clock} clubTimeMs={clubClock} layers={contour || (guideKind && movementGuide?.tracks?.[guideKind]) ? { ...layers, pose: false, hands: false, events: false } : layers} /></div>}
    {movementGuide?.status === "ready" && guideKind && <div className="absolute inset-0"><MovementGuideOverlay guide={movementGuide} kind={guideKind} timeMs={clock} /></div>}
    {contour && contourFrame?.video === videoRef.current && contourFrame.src === src && <div className="absolute inset-0"><PelvisContourOverlay evidence={contour} timeMs={contourFrame.timeMs} /></div>}
  </div>;
}

function ClubTrackingEvidence({ sidecar, overlay }: { sidecar?: DtlClubPointsV2Sidecar | null; overlay?: AnalysisOverlay | null }) {
  if (!sidecar) return null;
  const isComplete = sidecar.status === "succeeded";
  const isFailed = sidecar.status === "failed";

  return (
    <section className="rounded-xl border border-cyan-300/25 bg-cyan-400/[0.07] px-3 py-2.5" aria-label="DTL V2 클럽 추적 근거">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-cyan-100">DTL V2 클럽 추적</p>
          <p className="mt-0.5 text-[11px] leading-4 text-cyan-100/70">{overlay?.clubTimeSource === "video_pts" ? "파란 선은 헤드 궤적, 노란 선은 그립과 샤프트의 추정 위치입니다. 두 점이 실제 클럽과 맞는지 영상에서 확인하세요." : "클럽 궤적과 영상의 일치를 아직 확인하지 못했습니다."}</p>
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

function frameBound<T extends { timeMs: number }>(frames: T[], timeMs: number, after = false): number {
  let low = 0, high = frames.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (frames[mid].timeMs < timeMs || (after && frames[mid].timeMs === timeMs)) low = mid + 1;
    else high = mid;
  }
  return low;
}

function nearestAt<T extends { timeMs: number }>(frames: T[], timeMs: number): T | undefined {
  if (!Number.isFinite(timeMs)) return undefined;
  const index = frameBound(frames, timeMs), before = frames[index - 1], after = frames[index];
  const nearest = !before ? after : !after ? before : timeMs - before.timeMs <= after.timeMs - timeMs ? before : after;
  return nearest && Math.abs(nearest.timeMs - timeMs) <= POSE_FRAME_MAX_DISTANCE_MS ? nearest : undefined;
}

function validPosePoint(point: unknown): point is [number, number, number] {
  return Array.isArray(point) && point.length >= 3 && Number.isFinite(point[0]) && Number.isFinite(point[1])
    && Number.isFinite(point[2]) && point[2] >= .15;
}

function OverlaySvg({ pose, poseFrames, clubFrames, events, timeMs, clubTimeMs = timeMs, layers }: { pose?: AnalysisOverlay["poseFrames"][number]; poseFrames: AnalysisOverlay["poseFrames"]; clubFrames: AnalysisOverlay["clubFrames"]; events?: AnalysisResult["events"]; timeMs: number; clubTimeMs?: number; layers: Record<"pose" | "hands" | "club" | "events", boolean> }) {
  const hands = pose ? [pose.keypoints.left_wrist, pose.keypoints.right_wrist].filter(validPosePoint) : [];
  const latestClub = clubFrames.at(-1);
  const visibleShaft = latestClub && clubTimeMs - latestClub.timeMs <= 50
    && (latestClub.headValidUntilMs === undefined || clubTimeMs < latestClub.headValidUntilMs)
    && (latestClub.handleValidUntilMs === undefined || clubTimeMs < latestClub.handleValidUntilMs)
    && [latestClub.head, latestClub.handle].every((point) => point
      && (point.confidence ?? 0) >= CLUB_TRAIL_MIN_CONFIDENCE
      && Number.isFinite(point.x) && Number.isFinite(point.y));
  const headTrails = clubTrailSegments(clubFrames, "head");
  const handleTrails = clubTrailSegments(clubFrames, "handle");
  const currentEvent = Object.entries(events ?? {}).find(([, event]) => event && Math.abs(event.timeMs - timeMs) < 80)?.[0];
  return <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="block h-full w-full" aria-label="분석 오버레이">
    {layers.club ? <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {headTrails.map((segment, index) => {
        if (segment.length === 1) return <circle key={`head-${index}`} cx={segment[0].x} cy={segment[0].y} r="0.004" fill="#38bdf8" stroke="#082f49" strokeWidth="0.003" />;
        const path = smoothPathFromPoints(segment);
        return <g key={`head-${index}`}>
          <path d={path} stroke="#082f49" strokeWidth="0.013" opacity="0.45" />
          <path d={path} stroke="#38bdf8" strokeWidth="0.007" />
        </g>;
      })}
      {handleTrails.map((segment, index) => segment.length === 1
        ? <circle key={`handle-${index}`} cx={segment[0].x} cy={segment[0].y} r="0.003" fill="#fbbf24" />
        : <path key={`handle-${index}`} d={smoothPathFromPoints(segment)} stroke="#fbbf24" strokeWidth="0.006" strokeDasharray="0.014 0.01" />)}
    </g> : null}
    {layers.club && visibleShaft && latestClub?.head && latestClub.handle ? <line x1={latestClub.head.x} y1={latestClub.head.y} x2={latestClub.handle.x} y2={latestClub.handle.y} stroke="#fbbf24" strokeWidth="0.009" /> : null}
    {layers.pose && pose ? SKELETON_LINKS.map(([from, to]) => { const a = pose.keypoints[from]; const b = pose.keypoints[to]; return validPosePoint(a) && validPosePoint(b) ? <line key={`${from}-${to}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#34d399" strokeWidth="0.006" /> : null; }) : null}
    {layers.pose && pose ? Object.entries(pose.keypoints).map(([name, point]) => validPosePoint(point) ? <circle key={name} cx={point[0]} cy={point[1]} r="0.009" fill={jointColor(name)} /> : null) : null}
    {layers.hands ? (["left_wrist", "right_wrist"] as const).map((key) => {
      const trail = handTrailPaths(poseFrames, key, timeMs);
      return <g key={key} fill="none" stroke="#fb7185" strokeLinecap="round">
        {trail.map(({ bucket, path }) => {
          const fade = (bucket + .5) / 6;
          return <path key={bucket} d={path} strokeWidth={.002 + fade * .004} opacity={.08 + fade * .82} />;
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
  const segments: { from: HandTrailPoint; to: HandTrailPoint }[] = [];
  let previous: HandTrailPoint | undefined;
  for (const frame of poseFrames) {
    if (frame.timeMs < timeMs - HAND_TRAIL_DURATION_MS || frame.timeMs > timeMs) continue;
    const point = frame.keypoints[key];
    if (!validPosePoint(point)) { previous = undefined; continue; }
    const current = {timeMs: frame.timeMs, x: point[0], y: point[1]};
    if (!previous || current.timeMs <= previous.timeMs || current.timeMs - previous.timeMs > HAND_TRAIL_MAX_GAP_MS) previous = current;
    else if (current.timeMs - previous.timeMs >= HAND_TRAIL_MIN_SPACING_MS) {
      segments.push({from: previous, to: current});
      previous = current;
    }
  }
  return segments;
}

function handTrailPaths(poseFrames: AnalysisOverlay["poseFrames"], key: "left_wrist" | "right_wrist", timeMs: number) {
  const groups: string[][] = Array.from({length: 6}, () => []);
  for (const {from, to} of handTrailSegments(poseFrames, key, timeMs)) {
    const fade = Math.max(.08, 1 - (timeMs - to.timeMs) / HAND_TRAIL_DURATION_MS);
    const bucket = Math.min(5, Math.floor(fade * 6));
    groups[bucket].push(`M ${formatCoordinate(from.x)} ${formatCoordinate(from.y)} L ${formatCoordinate(to.x)} ${formatCoordinate(to.y)}`);
  }
  return groups.flatMap((parts, bucket) => parts.length ? [{bucket, path: parts.join(" ")}] : []);
}

function clubTrailSegments(clubFrames: AnalysisOverlay["clubFrames"], key: "head" | "handle") {
  const segments: ClubTrailPoint[][] = [];
  let current: ClubTrailPoint[] | null = null;
  for (const frame of [...clubFrames].sort((a, b) => a.timeMs - b.timeMs)) {
    if (key === "head" ? frame.headBreakBefore : frame.handleBreakBefore) current = null;
    const point = frame[key];
    if (!point || !((point.confidence ?? 0) >= CLUB_TRAIL_MIN_CONFIDENCE) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      current = null;
      continue;
    }
    if (!current || frame.timeMs - current.at(-1)!.timeMs > CLUB_TRAIL_MAX_GAP_MS) {
      current = [];
      segments.push(current);
    }
    current.push({ timeMs: frame.timeMs, x: point.x, y: point.y });
  }
  return segments;
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
