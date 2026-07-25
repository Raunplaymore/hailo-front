import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Crosshair,
  Database,
  FlaskConical,
  Pause,
  Play,
  RefreshCw,
  Save,
  Search,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import {
  ClubPreprocessLabResponse,
  DebugDetection,
  fetchInferDebugAnalysis,
  fetchInferDebugFrames,
  fetchSwingTrackingAnnotation,
  fetchSwingTrackingAnnotations,
  generateInferDebugMeta,
  InferDebugAnalysisResponse,
  InferDebugFramesResponse,
  runClubPreprocessLab,
  saveSwingTrackingAnnotation,
  SwingTrackingAnnotation,
  SwingTrackingAnnotationListResponse,
  SwingTrackingFrameLabel,
  SwingTrackingPoint,
} from "../../api/debug";
import { Button } from "../Button";
import { Input } from "../ui/input";

const EVENT_KEYS = ["address", "top", "impact", "finish"] as const;
const EVENT_LABELS = {
  address: "Address",
  top: "Top",
  impact: "Impact",
  finish: "Finish",
};
const LABEL_COLORS: Record<string, string> = {
  club_head: "#a3e635",
  club_handle: "#38bdf8",
  club: "#f59e0b",
  person: "#e879f9",
  golf_ball: "#fb7185",
};

type Point = { x: number; y: number };
type LabelTool = "clubHead" | "clubHandle";
type OverlayOptions = {
  modelBoxes: boolean;
  pose: boolean;
  bboxGuide: boolean;
  modelHeadPath: boolean;
  labels: boolean;
};

function getInitialJobId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("jobId") ?? "";
}

function normalizeBox(
  bbox: [number, number, number, number],
  meta: InferDebugFramesResponse["meta"]
): [number, number, number, number] {
  let [x, y, width, height] = bbox;
  if ((x > 1 || y > 1 || width > 1 || height > 1) && meta.width && meta.height) {
    x /= meta.width;
    width /= meta.width;
    y /= meta.height;
    height /= meta.height;
  }
  return [x, y, width, height];
}

function boxCenter(det: DebugDetection, meta: InferDebugFramesResponse["meta"]): Point {
  const [x, y, width, height] = normalizeBox(det.bbox, meta);
  return { x: x + width / 2, y: y + height / 2 };
}

function clubBoxEndpoint(det: DebugDetection, meta: InferDebugFramesResponse["meta"]): Point {
  const [x, y, width, height] = normalizeBox(det.bbox, meta);
  if (width >= height) return { x: x + width, y: y + height / 2 };
  return { x: x + width / 2, y: y + height };
}

function strongestDetection(
  frame: InferDebugFramesResponse["frames"][number],
  label: string,
  threshold: number
) {
  return frame.detections
    .filter((detection) => detection.label === label && detection.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence)[0];
}

function pathFromPoints(points: Point[]) {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${(point.x * 100).toFixed(2)} ${(point.y * 100).toFixed(2)}`
    )
    .join(" ");
}

function extractEvents(analysis: InferDebugAnalysisResponse | null) {
  const events = analysis?.analysis?.events ?? {};
  const valueFor = (name: (typeof EVENT_KEYS)[number]) => {
    const direct = events[`${name}Ms`];
    const nested = events[name];
    if (typeof direct === "number") return direct;
    if (
      nested &&
      typeof nested === "object" &&
      "timeMs" in nested &&
      typeof nested.timeMs === "number"
    ) {
      return nested.timeMs;
    }
    return null;
  };
  return {
    address: valueFor("address"),
    top: valueFor("top"),
    impact: valueFor("impact"),
    finish: valueFor("finish"),
  };
}

function nearestFrame(frames: InferDebugFramesResponse["frames"], timeMs: number) {
  return frames.reduce(
    (best, frame) =>
      Math.abs(frame.timeMs - timeMs) < Math.abs(best.timeMs - timeMs) ? frame : best,
    frames[0]
  );
}

function createDraftAnnotation(
  jobId: string,
  data: InferDebugFramesResponse,
  analysis: InferDebugAnalysisResponse | null,
  variant: "main" | "debug"
): SwingTrackingAnnotation {
  const analysisEvents = extractEvents(analysis);
  const events = Object.fromEntries(
    EVENT_KEYS.map((key) => {
      const timeMs = analysisEvents[key];
      if (timeMs == null || !data.frames.length) return [key, null];
      const frame = nearestFrame(data.frames, timeMs);
      return [key, { frame: frame.frame, timeMs: frame.timeMs, source: "analysis" as const }];
    })
  ) as SwingTrackingAnnotation["events"];
  return {
    schemaVersion: "swing-tracking-label-v1",
    jobId,
    viewpoint: "unknown",
    handedness: "right",
    status: "draft",
    events,
    frames: [],
    notes: "",
    source: {
      variant,
      analysisVersion: analysis?.analysis?.analysisVersion ?? null,
      metaPath: data.metaPath,
    },
  };
}

function frameLabelMap(annotation: SwingTrackingAnnotation | null) {
  return new Map((annotation?.frames ?? []).map((frame) => [frame.frame, frame]));
}

function upsertFrameLabel(
  annotation: SwingTrackingAnnotation,
  frame: InferDebugFramesResponse["frames"][number],
  update: (current: SwingTrackingFrameLabel) => SwingTrackingFrameLabel
) {
  const map = frameLabelMap(annotation);
  const current = map.get(frame.frame) ?? { frame: frame.frame, timeMs: frame.timeMs };
  const next = update(current);
  if (
    next.clubHead ||
    next.clubHandle ||
    next.clubHeadVisibility === "occluded" ||
    next.clubHeadVisibility === "out_of_frame" ||
    next.clubHandleVisibility === "occluded" ||
    next.clubHandleVisibility === "out_of_frame"
  ) {
    map.set(frame.frame, next);
  }
  else map.delete(frame.frame);
  return {
    ...annotation,
    frames: [...map.values()].sort((a, b) => a.frame - b.frame),
  };
}

function formatMs(value: number | null | undefined) {
  return value == null ? "—" : `${Math.round(value)} ms`;
}

function compactPoint(point?: SwingTrackingPoint) {
  if (!point) return "미지정";
  return `${point.x.toFixed(3)}, ${point.y.toFixed(3)}`;
}

function visibilityLabel(visibility?: SwingTrackingFrameLabel["clubHeadVisibility"]) {
  if (visibility === "occluded") return "가림";
  if (visibility === "out_of_frame") return "화면 밖";
  if (visibility === "visible") return "표시됨";
  return "미지정";
}

function LayerToggle({
  active,
  color,
  label,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center justify-between border-b border-white/5 px-3 py-2 text-left text-xs transition ${
        active ? "bg-white/[0.06] text-white" : "text-slate-500 hover:text-slate-300"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span>{active ? "ON" : "OFF"}</span>
    </button>
  );
}

export function InferDebugPage() {
  const [jobId, setJobId] = useState(getInitialJobId);
  const jobIdInputRef = useRef<HTMLInputElement>(null);
  const [variant, setVariant] = useState<"main" | "debug">("main");
  const [threshold, setThreshold] = useState(0.2);
  const [data, setData] = useState<InferDebugFramesResponse | null>(null);
  const [analysis, setAnalysis] = useState<InferDebugAnalysisResponse | null>(null);
  const [annotation, setAnnotation] = useState<SwingTrackingAnnotation | null>(null);
  const [annotationCatalog, setAnnotationCatalog] =
    useState<SwingTrackingAnnotationListResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTool, setActiveTool] = useState<LabelTool>("clubHead");
  const [focusMode, setFocusMode] = useState(true);
  const [overlayOptions, setOverlayOptions] = useState<OverlayOptions>({
    modelBoxes: true,
    pose: true,
    bboxGuide: true,
    modelHeadPath: true,
    labels: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingDebug, setIsGeneratingDebug] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRunningLab, setIsRunningLab] = useState(false);
  const [labReport, setLabReport] = useState<ClubPreprocessLabResponse | null>(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedFrame = data?.frames[selectedIndex] ?? null;
  const labelsByFrame = useMemo(() => frameLabelMap(annotation), [annotation]);
  const currentLabel = selectedFrame ? labelsByFrame.get(selectedFrame.frame) : undefined;
  const analysisEvents = useMemo(() => extractEvents(analysis), [analysis]);

  const modelHeadTrack = useMemo(() => {
    if (!data) return [];
    return data.frames
      .map((frame) => strongestDetection(frame, "club_head", threshold))
      .filter((detection): detection is DebugDetection => Boolean(detection))
      .map((detection) => boxCenter(detection, data.meta));
  }, [data, threshold]);

  const bboxGuideTrack = useMemo(() => {
    if (!data) return [];
    return data.frames
      .map((frame) => strongestDetection(frame, "club", threshold))
      .filter((detection): detection is DebugDetection => Boolean(detection))
      .map((detection) => clubBoxEndpoint(detection, data.meta));
  }, [data, threshold]);

  const labeledHeadTrack = useMemo(
    () => (annotation?.frames ?? []).flatMap((frame) => (frame.clubHead ? [frame.clubHead] : [])),
    [annotation]
  );

  const summary = useMemo(() => {
    if (!data) return null;
    const headFrames = data.frames.filter((frame) =>
      frame.detections.some((detection) => detection.label === "club_head")
    ).length;
    const handleFrames = data.frames.filter((frame) =>
      frame.detections.some((detection) => detection.label === "club_handle")
    ).length;
    const pairedFrames = data.frames.filter(
      (frame) =>
        frame.detections.some((detection) => detection.label === "club_head") &&
        frame.detections.some((detection) => detection.label === "club_handle")
    ).length;
    return { headFrames, handleFrames, pairedFrames };
  }, [data]);

  const annotationSummary = useMemo(() => {
    const frames = annotation?.frames ?? [];
    return {
      head: frames.filter((frame) => frame.clubHead).length,
      handle: frames.filter((frame) => frame.clubHandle).length,
      headHidden: frames.filter((frame) => frame.clubHeadVisibility === "occluded" || frame.clubHeadVisibility === "out_of_frame").length,
      handleHidden: frames.filter((frame) => frame.clubHandleVisibility === "occluded" || frame.clubHandleVisibility === "out_of_frame").length,
      events: EVENT_KEYS.filter((key) => annotation?.events[key]).length,
    };
  }, [annotation]);

  const mutateAnnotation = (update: (current: SwingTrackingAnnotation) => SwingTrackingAnnotation) => {
    setAnnotation((current) => (current ? update(current) : current));
    setDirty(true);
    setNotice(null);
  };

  const refreshAnnotationCatalog = async () => {
    try {
      setAnnotationCatalog(await fetchSwingTrackingAnnotations());
    } catch {
      // Catalog visibility must not block frame labeling.
    }
  };

  const loadVariant = async (
    targetVariant: "main" | "debug",
    force = false,
    requestedJobId?: string
  ) => {
    const trimmed = (requestedJobId ?? jobId).trim();
    if (!trimmed) {
      setError("jobId를 입력하세요.");
      return;
    }
    setJobId(trimmed);
    setIsLoading(true);
    setError(null);
    setNotice(null);
    setLabReport(null);
    setIsPlaying(false);
    try {
      const [next, nextAnalysis, stored] = await Promise.all([
        fetchInferDebugFrames(trimmed, { limit: 240, force, variant: targetVariant }),
        fetchInferDebugAnalysis(trimmed).catch(() => null),
        fetchSwingTrackingAnnotation(trimmed),
      ]);
      const loadedAnnotation =
        stored.annotation ?? createDraftAnnotation(trimmed, next, nextAnalysis, targetVariant);
      const nextAnnotation =
        loadedAnnotation.handedness === "unknown"
          ? { ...loadedAnnotation, handedness: "right" as const }
          : loadedAnnotation;
      setData(next);
      setAnalysis(nextAnalysis);
      setAnnotation(nextAnnotation);
      setVariant(targetVariant);
      const impact = nextAnnotation.events.impact;
      const initialIndex = impact
        ? next.frames.reduce(
            (bestIndex, frame, index) =>
              Math.abs(frame.timeMs - impact.timeMs) <
              Math.abs(next.frames[bestIndex].timeMs - impact.timeMs)
                ? index
                : bestIndex,
            0
          )
        : 0;
      setSelectedIndex(initialIndex);
      setDirty(loadedAnnotation.handedness === "unknown");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("jobId", trimmed);
        window.history.replaceState(null, "", url);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "실험 데이터를 불러오지 못했습니다.");
      setData(null);
      setAnalysis(null);
      setAnnotation(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoad = (event: FormEvent) => {
    event.preventDefault();
    void loadVariant(variant, false);
  };

  const handleGenerateDebugMeta = async () => {
    if (!jobId.trim()) return;
    setIsGeneratingDebug(true);
    setError(null);
    try {
      await generateInferDebugMeta(jobId.trim());
      await loadVariant("debug", true);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "debug meta 생성에 실패했습니다.");
    } finally {
      setIsGeneratingDebug(false);
    }
  };

  const handleSave = async () => {
    if (!annotation || !jobId.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await saveSwingTrackingAnnotation(jobId.trim(), annotation);
      if (response.annotation) setAnnotation(response.annotation);
      await refreshAnnotationCatalog();
      setDirty(false);
      setNotice("라벨을 저장했습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "라벨 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunLab = async () => {
    if (!jobId.trim()) return;
    setIsRunningLab(true);
    setError(null);
    try {
      setLabReport(await runClubPreprocessLab(jobId.trim()));
    } catch (labError) {
      setError(labError instanceof Error ? labError.message : "보정 비교에 실패했습니다.");
    } finally {
      setIsRunningLab(false);
    }
  };

  const assignPoint = (key: "clubHead" | "clubHandle", point: SwingTrackingPoint) => {
    if (!selectedFrame) return;
    const visibilityKey = key === "clubHead" ? "clubHeadVisibility" : "clubHandleVisibility";
    mutateAnnotation((current) =>
      upsertFrameLabel(current, selectedFrame, (frame) => ({
        ...frame,
        [key]: point,
        [visibilityKey]: "visible",
      }))
    );
  };

  const handleCanvasClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!selectedFrame || !annotation) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      source: "manual" as const,
    };
    assignPoint(activeTool, point);
  };

  const setPointVisibility = (
    key: "clubHead" | "clubHandle",
    visibility: "occluded" | "out_of_frame"
  ) => {
    if (!selectedFrame) return;
    mutateAnnotation((current) =>
      upsertFrameLabel(current, selectedFrame, (frame) =>
        key === "clubHead"
          ? { ...frame, clubHead: undefined, clubHeadVisibility: visibility }
          : { ...frame, clubHandle: undefined, clubHandleVisibility: visibility }
      )
    );
  };

  const clearCurrentFrameLabels = () => {
    if (!selectedFrame) return;
    mutateAnnotation((current) =>
      upsertFrameLabel(current, selectedFrame, (frame) => ({
        frame: frame.frame,
        timeMs: frame.timeMs,
      }))
    );
  };

  const prefillCurrent = () => {
    if (!selectedFrame || !data) return;
    const head = strongestDetection(selectedFrame, "club_head", threshold);
    const handle = strongestDetection(selectedFrame, "club_handle", threshold);
    if (!head && !handle) {
      setNotice("현재 threshold에서 사용할 검출점이 없습니다.");
      return;
    }
    mutateAnnotation((current) =>
      upsertFrameLabel(current, selectedFrame, (frame) => ({
        ...frame,
        ...(head
          ? {
              clubHead: { ...boxCenter(head, data.meta), source: "model" as const },
              clubHeadVisibility: "visible" as const,
            }
          : {}),
        ...(handle
          ? {
              clubHandle: { ...boxCenter(handle, data.meta), source: "model" as const },
              clubHandleVisibility: "visible" as const,
            }
          : {}),
      }))
    );
  };

  const prefillAll = () => {
    if (!data || !annotation) return;
    const frames = data.frames.flatMap((frame) => {
      const head = strongestDetection(frame, "club_head", threshold);
      const handle = strongestDetection(frame, "club_handle", threshold);
      if (!head && !handle) return [];
      return [
        {
          frame: frame.frame,
          timeMs: frame.timeMs,
          ...(head
            ? {
                clubHead: { ...boxCenter(head, data.meta), source: "model" as const },
                clubHeadVisibility: "visible" as const,
              }
            : {}),
          ...(handle
            ? {
                clubHandle: { ...boxCenter(handle, data.meta), source: "model" as const },
                clubHandleVisibility: "visible" as const,
              }
            : {}),
        },
      ];
    });
    mutateAnnotation((current) => {
      const existing = frameLabelMap(current);
      frames.forEach((frame) => {
        const old = existing.get(frame.frame);
        existing.set(frame.frame, {
          ...frame,
          ...old,
          clubHead: old?.clubHead ?? frame.clubHead,
          clubHandle: old?.clubHandle ?? frame.clubHandle,
        });
      });
      return { ...current, frames: [...existing.values()].sort((a, b) => a.frame - b.frame) };
    });
    setNotice(`${frames.length}개 프레임에 모델 검출 초안을 채웠습니다.`);
  };

  const markEvent = (key: (typeof EVENT_KEYS)[number]) => {
    if (!selectedFrame) return;
    mutateAnnotation((current) => ({
      ...current,
      events: {
        ...current.events,
        [key]: {
          frame: selectedFrame.frame,
          timeMs: selectedFrame.timeMs,
          source: "manual",
        },
      },
    }));
  };

  const jumpToFrame = (frameNumber: number) => {
    if (!data) return;
    const index = data.frames.findIndex((frame) => frame.frame === frameNumber);
    if (index >= 0) setSelectedIndex(index);
  };

  const toggleOverlay = (key: keyof OverlayOptions) => {
    setOverlayOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  useEffect(() => {
    void refreshAnnotationCatalog();
  }, []);

  useEffect(() => {
    if (!isPlaying || !data) return;
    const timer = window.setInterval(() => {
      setSelectedIndex((current) => {
        if (current >= data.frames.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [isPlaying, data]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!data || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(0, current - 1));
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(data.frames.length - 1, current + 1));
      }
      if (event.key === "1") setActiveTool("clubHead");
      if (event.key === "2") setActiveTool("clubHandle");
      if (event.key.toLowerCase() === "f") setFocusMode((current) => !current);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const keypoint = (name: string) => {
    const value = selectedFrame?.keypoints?.[name];
    if (!value || value[2] < 0.25) return null;
    return { x: value[0], y: value[1] };
  };
  const poseSegments: [Point | null, Point | null][] = [
    [keypoint("left_shoulder"), keypoint("right_shoulder")],
    [keypoint("left_hip"), keypoint("right_hip")],
    [keypoint("left_shoulder"), keypoint("left_elbow")],
    [keypoint("left_elbow"), keypoint("left_wrist")],
    [keypoint("right_shoulder"), keypoint("right_elbow")],
    [keypoint("right_elbow"), keypoint("right_wrist")],
    [keypoint("left_shoulder"), keypoint("left_hip")],
    [keypoint("right_shoulder"), keypoint("right_hip")],
  ];
  const visibleDetections =
    selectedFrame?.detections.filter((detection) => detection.confidence >= threshold) ?? [];

  return (
    <main className="min-h-screen bg-[#070b12] text-slate-100">
      <div className="border-b border-white/10 bg-[#0b111b]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center border border-cyan-300/30 bg-cyan-300/10 text-cyan-300">
              <Crosshair className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300">
                Swing Tracking Lab
              </p>
              <h1 className="text-lg font-semibold tracking-tight">클럽 궤적 검증 작업대</h1>
            </div>
          </div>

          <form className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto" onSubmit={handleLoad}>
            <div className="relative w-full sm:min-w-72">
              <Input
                ref={jobIdInputRef}
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
                placeholder="jobId"
                aria-label="jobId"
                className="h-10 border-white/10 bg-black/30 pr-9"
              />
              {jobId ? (
                <button
                  type="button"
                  onClick={() => setJobId("")}
                  className="absolute right-2 top-2.5 text-slate-500 hover:text-white"
                  aria-label="jobId 지우기"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <select
              value={variant}
              onChange={(event) => setVariant(event.target.value === "debug" ? "debug" : "main")}
              className="h-10 border border-white/10 bg-black/30 px-3 text-sm"
              aria-label="meta variant"
            >
              <option value="main">main meta</option>
              <option value="debug">debug meta</option>
            </select>
            <Button
              type="submit"
              fullWidth={false}
              isLoading={isLoading}
              className="h-10 px-5 py-0 text-sm"
            >
              <span className="inline-flex items-center gap-2">
                <Search className="size-4" /> 불러오기
              </span>
            </Button>
            <Button
              type="button"
              fullWidth={false}
              variant="outline"
              disabled={!data || isLoading}
              onClick={() => void loadVariant(variant, true)}
              className="h-10 px-3 py-0 text-sm"
              aria-label="새로고침"
            >
              <RefreshCw className="size-4" />
            </Button>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] p-4 sm:p-6">
        {error ? (
          <div className="mb-4 border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mb-4 border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
            {notice}
          </div>
        ) : null}

        <section className="mb-4 border border-white/10 bg-[#0d141f]">
          <div className="grid gap-4 p-4 md:grid-cols-[14rem_minmax(0,1fr)] md:items-center">
            <div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
                    Dataset progress
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    저장 {annotationCatalog?.count ?? "—"} / {annotationCatalog?.target ?? 30}
                  </p>
                </div>
                <span className="font-mono text-xs text-slate-500">
                  {annotationCatalog
                    ? `${Math.min(100, Math.round((annotationCatalog.count / annotationCatalog.target) * 100))}%`
                    : "불러오는 중"}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden bg-white/10">
                <div
                  className="h-full bg-cyan-300 transition-[width]"
                  style={{
                    width: annotationCatalog
                      ? `${Math.min(100, (annotationCatalog.count / annotationCatalog.target) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                10개에서 라벨 기준을 점검하고, 30개에서 1차 추적 성능을 비교합니다.
              </p>
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">저장된 스윙</p>
                <button
                  type="button"
                  onClick={() => void refreshAnnotationCatalog()}
                  className="text-[11px] text-slate-500 hover:text-white"
                >
                  새로고침
                </button>
              </div>
              {annotationCatalog?.annotations.length ? (
                <div className="grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                  {annotationCatalog.annotations.map((item, index) => (
                    <button
                      key={item.jobId}
                      type="button"
                      onClick={() => {
                        if (dirty && !window.confirm("저장하지 않은 현재 라벨을 버리고 이동할까요?")) return;
                        void loadVariant("main", false, item.jobId);
                      }}
                      className="min-w-0 border border-white/10 bg-black/20 px-3 py-2 text-left hover:border-cyan-300/30 hover:bg-cyan-300/5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white">#{index + 1}</span>
                        <span className={item.status === "reviewed" ? "text-[10px] text-emerald-300" : "text-[10px] text-amber-300"}>
                          {item.status === "reviewed" ? "검토 완료" : "초안"}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{item.jobId}</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        라벨 {item.labeledFrames}F · 이벤트 {item.events}/4
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid h-20 place-items-center border border-dashed border-white/10 text-xs text-slate-600">
                  아직 저장된 스윙이 없습니다.
                </div>
              )}
            </div>
          </div>
        </section>

        {!data ? (
          <section className="grid min-h-[70vh] place-items-center">
            <div className="max-w-xl border border-white/10 bg-white/[0.025] p-8 text-center">
              <Database className="mx-auto size-8 text-cyan-300" />
              <h2 className="mt-4 text-xl font-semibold">검증할 스윙을 불러오세요</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                모델 검출과 pose를 초안으로 사용하고, 프레임별 club head·handle과 네 개의
                이벤트를 사람이 확인합니다. 저장된 라벨은 운영 분석과 분리됩니다.
              </p>
            </div>
          </section>
        ) : (
          <>
            <section className="mb-4 grid grid-cols-2 border border-white/10 bg-white/[0.025] md:grid-cols-4">
              {[
                ["프레임", `${data.frames.length} / ${data.meta.frames}`],
                ["Head 검출", `${summary?.headFrames ?? 0}`],
                ["Handle 검출", `${summary?.handleFrames ?? 0}`],
                ["동시 검출", `${summary?.pairedFrames ?? 0}`],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-r border-white/10 px-4 py-3 last:border-r-0 md:border-b-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                  <p className="mt-1 font-mono text-xl text-white">{value}</p>
                </div>
              ))}
            </section>

            <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
              <aside className="order-2 grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-2 2xl:order-1 2xl:col-span-1 2xl:block 2xl:space-y-4">
                <div className="border border-white/10 bg-[#0d141f]">
                  <div className="border-b border-white/10 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Dataset contract</p>
                  </div>
                  <div className="space-y-3 p-4">
                    <label className="block text-xs text-slate-400">
                      카메라 시점
                      <select
                        value={annotation?.viewpoint ?? "unknown"}
                        onChange={(event) =>
                          mutateAnnotation((current) => ({
                            ...current,
                            viewpoint: event.target.value as SwingTrackingAnnotation["viewpoint"],
                          }))
                        }
                        className="mt-1 h-10 w-full border border-white/10 bg-black/30 px-3 text-sm text-white"
                      >
                        <option value="unknown">미지정</option>
                        <option value="down_the_line">Down the line</option>
                        <option value="face_on">Face on</option>
                      </select>
                    </label>
                    <label className="block text-xs text-slate-400">
                      타석
                      <select
                        value={annotation?.handedness === "left" ? "left" : "right"}
                        onChange={(event) =>
                          mutateAnnotation((current) => ({
                            ...current,
                            handedness: event.target.value as SwingTrackingAnnotation["handedness"],
                          }))
                        }
                        className="mt-1 h-10 w-full border border-white/10 bg-black/30 px-3 text-sm text-white"
                      >
                        <option value="right">오른손</option>
                        <option value="left">왼손</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="border border-white/10 bg-[#0d141f]">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Swing events</p>
                    <span className="font-mono text-xs text-cyan-300">{annotationSummary.events}/4</span>
                  </div>
                  <div>
                    {EVENT_KEYS.map((key) => {
                      const event = annotation?.events[key];
                      const delta =
                        event && analysisEvents[key] != null
                          ? event.timeMs - Number(analysisEvents[key])
                          : null;
                      return (
                        <div key={key} className="border-b border-white/5 p-3 last:border-b-0">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => event && jumpToFrame(event.frame)}
                              className="text-left"
                            >
                              <span className="text-sm font-semibold text-white">{EVENT_LABELS[key]}</span>
                              <span className="ml-2 font-mono text-xs text-slate-500">
                                {event ? `F${event.frame}` : "—"}
                              </span>
                            </button>
                            {delta != null ? (
                              <span className={`font-mono text-[10px] ${Math.abs(delta) <= 100 ? "text-emerald-300" : "text-amber-300"}`}>
                                AI {delta >= 0 ? "+" : ""}{Math.round(delta)}ms
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => markEvent(key)}
                            className="mt-2 w-full border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-slate-300 hover:border-cyan-300/40 hover:text-white"
                          >
                            현재 F{selectedFrame?.frame} 지정
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>

              <section className="order-1 min-w-0 border border-white/10 bg-[#0d141f] lg:col-start-1 lg:row-start-1 2xl:order-2 2xl:col-start-2">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="font-mono text-sm text-white">
                      Frame {selectedFrame?.frame} <span className="text-slate-500">/ {data.meta.frames - 1}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-cyan-300">{formatMs(selectedFrame?.timeMs)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFocusMode((current) => !current)}
                      className={`mr-2 h-9 border px-3 text-xs ${
                        focusMode
                          ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200"
                          : "border-white/10 text-slate-400"
                      }`}
                      aria-pressed={focusMode}
                    >
                      포커스 {focusMode ? "ON" : "OFF"} <span className="ml-1 text-[9px] opacity-60">F</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIndex((current) => Math.max(0, current - 1))}
                      className="grid size-9 place-items-center border border-white/10 hover:bg-white/10"
                      aria-label="이전 프레임"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPlaying((current) => !current)}
                      className="grid size-9 place-items-center bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                      aria-label={isPlaying ? "일시정지" : "재생"}
                    >
                      {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIndex((current) => Math.min(data.frames.length - 1, current + 1))
                      }
                      className="grid size-9 place-items-center border border-white/10 hover:bg-white/10"
                      aria-label="다음 프레임"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="relative mx-auto max-h-[72vh] w-fit overflow-hidden bg-black">
                  {selectedFrame ? (
                    <>
                      <img
                        src={selectedFrame.imageUrl}
                        alt={`frame ${selectedFrame.frame}`}
                        className="block max-h-[72vh] max-w-full object-contain"
                      />
                      <svg
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        {!focusMode && overlayOptions.bboxGuide && bboxGuideTrack.length > 1 ? (
                          <path
                            d={pathFromPoints(bboxGuideTrack)}
                            fill="none"
                            stroke="#22d3ee"
                            strokeDasharray="1.4 1.2"
                            strokeWidth="0.55"
                            opacity="0.62"
                          />
                        ) : null}
                        {!focusMode && overlayOptions.modelHeadPath && modelHeadTrack.length > 1 ? (
                          <path
                            d={pathFromPoints(modelHeadTrack)}
                            fill="none"
                            stroke="#a3e635"
                            strokeWidth="0.65"
                            opacity="0.7"
                          />
                        ) : null}
                        {!focusMode && overlayOptions.labels && labeledHeadTrack.length > 1 ? (
                          <path
                            d={pathFromPoints(labeledHeadTrack)}
                            fill="none"
                            stroke="#fb7185"
                            strokeWidth="0.9"
                          />
                        ) : null}
                        {!focusMode && overlayOptions.pose
                          ? poseSegments.map(([start, end], index) =>
                              start && end ? (
                                <line
                                  key={index}
                                  x1={start.x * 100}
                                  y1={start.y * 100}
                                  x2={end.x * 100}
                                  y2={end.y * 100}
                                  stroke="#facc15"
                                  strokeWidth="0.55"
                                  opacity="0.75"
                                />
                              ) : null
                            )
                          : null}
                        {!focusMode && overlayOptions.modelBoxes
                          ? visibleDetections.map((detection, index) => {
                              const [x, y, width, height] = normalizeBox(detection.bbox, data.meta);
                              const color = LABEL_COLORS[detection.label] ?? "#e2e8f0";
                              return (
                                <g key={`${detection.label}-${index}`}>
                                  <rect
                                    x={x * 100}
                                    y={y * 100}
                                    width={width * 100}
                                    height={height * 100}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth="0.45"
                                  />
                                  <text
                                    x={x * 100}
                                    y={Math.max(2, y * 100 - 0.8)}
                                    fill={color}
                                    fontSize="2"
                                    fontWeight="700"
                                  >
                                    {detection.label} {detection.confidence.toFixed(2)}
                                  </text>
                                </g>
                              );
                            })
                          : null}
                        {(focusMode || overlayOptions.labels) && currentLabel?.clubHead ? (
                          <g>
                            <circle
                              cx={currentLabel.clubHead.x * 100}
                              cy={currentLabel.clubHead.y * 100}
                              r="1.7"
                              fill="#fb7185"
                              stroke="white"
                              strokeWidth="0.45"
                            />
                            <text
                              x={currentLabel.clubHead.x * 100 + 2.2}
                              y={currentLabel.clubHead.y * 100}
                              fill="#fb7185"
                              fontSize="2.2"
                              fontWeight="700"
                            >
                              CLUB HEAD GT
                            </text>
                          </g>
                        ) : null}
                        {(focusMode || overlayOptions.labels) && currentLabel?.clubHandle ? (
                          <g>
                            <circle
                              cx={currentLabel.clubHandle.x * 100}
                              cy={currentLabel.clubHandle.y * 100}
                              r="1.7"
                              fill="#c084fc"
                              stroke="white"
                              strokeWidth="0.45"
                            />
                            <text
                              x={currentLabel.clubHandle.x * 100 + 2.2}
                              y={currentLabel.clubHandle.y * 100}
                              fill="#c084fc"
                              fontSize="2.2"
                              fontWeight="700"
                            >
                              GRIP GT
                            </text>
                          </g>
                        ) : null}
                      </svg>
                      <button
                        type="button"
                        className="absolute inset-0 h-full w-full cursor-crosshair"
                        onClick={handleCanvasClick}
                        aria-label="프레임에 정답점 지정"
                      />
                      <div className="pointer-events-none absolute left-3 top-3 border border-white/10 bg-black/65 px-2 py-1 font-mono text-[10px] text-slate-300">
                        {activeTool === "clubHead"
                          ? "CLICK → GOLF CLUB HEAD"
                          : "CLICK → GRIP CENTER"}
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="border-t border-white/10 p-4">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, data.frames.length - 1)}
                    value={selectedIndex}
                    onChange={(event) => {
                      setIsPlaying(false);
                      setSelectedIndex(Number(event.target.value));
                    }}
                    className="w-full accent-cyan-300"
                    aria-label="프레임 타임라인"
                  />
                  <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-600">
                    <span>F{data.frames[0]?.frame}</span>
                    {EVENT_KEYS.map((key) => {
                      const event = annotation?.events[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={!event}
                          onClick={() => event && jumpToFrame(event.frame)}
                          className={event ? "text-cyan-300 hover:text-white" : ""}
                        >
                          {key.toUpperCase()} {event ? `F${event.frame}` : "—"}
                        </button>
                      );
                    })}
                    <span>F{data.frames.at(-1)?.frame}</span>
                  </div>
                </div>
              </section>

              <aside className="order-3 grid gap-4 sm:grid-cols-2 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1 lg:block lg:space-y-4 2xl:col-start-3">
                <div className="border border-white/10 bg-[#0d141f]">
                  <div className="border-b border-white/10 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Label tool</p>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-white/10">
                    {[
                      ["clubHead", "1", "클럽 헤드", "#fb7185"],
                      ["clubHandle", "2", "그립 중심", "#c084fc"],
                    ].map(([tool, shortcut, label, color]) => (
                      <button
                        key={tool}
                        type="button"
                        onClick={() => setActiveTool(tool as LabelTool)}
                        className={`bg-[#0d141f] px-2 py-3 text-xs transition ${
                          activeTool === tool ? "text-white ring-1 ring-inset ring-cyan-300" : "text-slate-500"
                        }`}
                      >
                        <span
                          className="mx-auto mb-1 block size-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        {label}
                        <span className="ml-1 text-[9px] text-slate-600">{shortcut}</span>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2 p-4 text-xs">
                    <div className="border border-rose-300/15 bg-rose-300/[0.03] p-3">
                      <div className="flex items-center justify-between gap-2 text-slate-300">
                        <span className="font-semibold">클럽 헤드</span>
                        <span className="font-mono text-rose-300">
                          {currentLabel?.clubHead
                            ? compactPoint(currentLabel.clubHead)
                            : visibilityLabel(currentLabel?.clubHeadVisibility)}
                        </span>
                      </div>
                      <p className="mt-1 leading-5 text-slate-500">
                        사람 머리가 아니라 실제 골프채 헤드의 중앙
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPointVisibility("clubHead", "occluded")}
                          className="border border-white/10 px-2 py-1.5 text-slate-400 hover:text-white"
                        >
                          가림
                        </button>
                        <button
                          type="button"
                          onClick={() => setPointVisibility("clubHead", "out_of_frame")}
                          className="border border-white/10 px-2 py-1.5 text-slate-400 hover:text-white"
                        >
                          화면 밖
                        </button>
                      </div>
                    </div>
                    <div className="border border-purple-300/15 bg-purple-300/[0.03] p-3">
                      <div className="flex items-center justify-between gap-2 text-slate-300">
                        <span className="font-semibold">그립 중심</span>
                        <span className="font-mono text-purple-300">
                          {currentLabel?.clubHandle
                            ? compactPoint(currentLabel.clubHandle)
                            : visibilityLabel(currentLabel?.clubHandleVisibility)}
                        </span>
                      </div>
                      <p className="mt-1 leading-5 text-slate-500">
                        양손이 잡고 있는 그립 부분의 중앙
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPointVisibility("clubHandle", "occluded")}
                          className="border border-white/10 px-2 py-1.5 text-slate-400 hover:text-white"
                        >
                          가림
                        </button>
                        <button
                          type="button"
                          onClick={() => setPointVisibility("clubHandle", "out_of_frame")}
                          className="border border-white/10 px-2 py-1.5 text-slate-400 hover:text-white"
                        >
                          화면 밖
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={prefillCurrent}
                      className="mt-2 flex w-full items-center justify-center gap-2 border border-white/10 bg-white/[0.04] px-3 py-2 text-slate-300 hover:text-white"
                    >
                      <WandSparkles className="size-3.5" /> 현재 검출 초안
                    </button>
                    <button
                      type="button"
                      onClick={prefillAll}
                      className="flex w-full items-center justify-center gap-2 border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-cyan-200 hover:bg-cyan-300/10"
                    >
                      <CircleDot className="size-3.5" /> 전체 자동 pre-label
                    </button>
                    <button
                      type="button"
                      onClick={clearCurrentFrameLabels}
                      disabled={!currentLabel}
                      className="flex w-full items-center justify-center gap-2 border border-rose-300/20 px-3 py-2 text-rose-200 hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="size-3.5" /> 현재 프레임 라벨 삭제
                    </button>
                  </div>
                </div>

                <div className="border border-white/10 bg-[#0d141f]">
                  <div className="border-b border-white/10 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Evidence layers</p>
                  </div>
                  <LayerToggle
                    active={focusMode}
                    color="#67e8f9"
                    label="Labeling focus"
                    onClick={() => setFocusMode((current) => !current)}
                  />
                  <LayerToggle active={overlayOptions.labels} color="#fb7185" label="Ground truth labels" onClick={() => toggleOverlay("labels")} />
                  <LayerToggle active={overlayOptions.modelBoxes} color="#a3e635" label="Model detections" onClick={() => toggleOverlay("modelBoxes")} />
                  <LayerToggle active={overlayOptions.modelHeadPath} color="#a3e635" label="Model head path" onClick={() => toggleOverlay("modelHeadPath")} />
                  <LayerToggle active={overlayOptions.bboxGuide} color="#22d3ee" label="Club bbox guide" onClick={() => toggleOverlay("bboxGuide")} />
                  <LayerToggle active={overlayOptions.pose} color="#facc15" label="Pose skeleton" onClick={() => toggleOverlay("pose")} />
                  <div className="p-3 text-[11px] leading-5 text-slate-500">
                    포커스 ON에서는 선·박스·스켈레톤을 숨기고 현재 정답점만 표시합니다. F키로 빠르게 비교할 수 있습니다.
                    Bbox guide는 tracker 결과가 아니라 club 박스 장축 끝점입니다.
                  </div>
                </div>

                <div className="border border-white/10 bg-[#0d141f] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Label coverage</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        Head {annotationSummary.head} (+{annotationSummary.headHidden} 상태) · Grip{" "}
                        {annotationSummary.handle} (+{annotationSummary.handleHidden} 상태)
                      </p>
                    </div>
                    <select
                      value={annotation?.status ?? "draft"}
                      onChange={(event) =>
                        mutateAnnotation((current) => ({
                          ...current,
                          status: event.target.value as SwingTrackingAnnotation["status"],
                        }))
                      }
                      className="h-8 border border-white/10 bg-black/30 px-2 text-xs"
                    >
                      <option value="draft">Draft</option>
                      <option value="reviewed">Reviewed</option>
                    </select>
                  </div>
                  <textarea
                    value={annotation?.notes ?? ""}
                    onChange={(event) =>
                      mutateAnnotation((current) => ({ ...current, notes: event.target.value }))
                    }
                    placeholder="가림, 오검출, 촬영 특이사항"
                    className="mt-3 min-h-20 w-full resize-y border border-white/10 bg-black/30 p-2 text-xs text-white outline-none focus:border-cyan-300/40"
                  />
                  <Button
                    type="button"
                    fullWidth
                    onClick={() => void handleSave()}
                    isLoading={isSaving}
                    disabled={!annotation || !dirty}
                    className="mt-3 flex h-10 items-center justify-center gap-2 py-0 text-sm"
                  >
                    {dirty ? <Save className="size-4" /> : <Check className="size-4" />}
                    {dirty ? "라벨 저장" : "저장됨"}
                  </Button>
                  <p className="mt-2 text-center text-[10px] text-slate-600">⌘/Ctrl + S</p>
                </div>

                <div className="border border-white/10 bg-[#0d141f] p-4">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="size-4 text-amber-300" />
                    <p className="text-sm font-semibold">Preprocess lab</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    원본·대비 보정·손목 ROI 검출률을 비교합니다. 정답 라벨은 변경하지 않습니다.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isGeneratingDebug}
                      onClick={() => void handleGenerateDebugMeta()}
                      className="border border-white/10 px-2 py-2 text-xs text-slate-300 hover:text-white disabled:opacity-50"
                    >
                      Debug meta
                    </button>
                    <button
                      type="button"
                      disabled={isRunningLab}
                      onClick={() => void handleRunLab()}
                      className="border border-amber-300/20 bg-amber-300/5 px-2 py-2 text-xs text-amber-200 disabled:opacity-50"
                    >
                      {isRunningLab ? "비교 중…" : "보정 비교"}
                    </button>
                  </div>
                </div>
              </aside>
            </section>

            {labReport ? (
              <section className="mt-4 border border-white/10 bg-[#0d141f] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Preprocess comparison</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {labReport.report.decision === "candidate_for_visual_review"
                        ? "수치 개선 후보입니다. 라벨과 겹쳐 오검출 여부를 확인하세요."
                        : "이번 영상에서는 운영 후보 수준의 개선이 없습니다."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLabReport(null)}
                    className="text-slate-500 hover:text-white"
                    aria-label="비교 결과 닫기"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {Object.entries(labReport.report.results).map(([name, result]) => (
                    <div key={name} className="border border-white/10 bg-black/20 p-3">
                      <p className="text-xs font-semibold uppercase text-slate-300">{name}</p>
                      <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                        <dt className="text-slate-500">Head</dt><dd className="text-right font-mono">{result.detectedFrames.club_head ?? 0}</dd>
                        <dt className="text-slate-500">Handle</dt><dd className="text-right font-mono">{result.detectedFrames.club_handle ?? 0}</dd>
                        <dt className="text-slate-500">Paired</dt><dd className="text-right font-mono">{result.pairedHeadHandleFrames}</dd>
                      </dl>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
