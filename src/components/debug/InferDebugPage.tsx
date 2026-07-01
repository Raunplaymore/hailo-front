import { FormEvent, useMemo, useState } from "react";
import { Filter, RefreshCw, Search } from "lucide-react";
import {
  DebugDetection,
  fetchInferDebugAnalysis,
  fetchInferDebugFrames,
  generateInferDebugMeta,
  InferDebugAnalysisResponse,
  InferDebugFramesResponse,
} from "../../api/debug";
import { Button } from "../Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

const LABEL_COLORS: Record<string, string> = {
  club_head: "#22c55e",
  club_handle: "#38bdf8",
  club: "#f59e0b",
  person: "#e879f9",
  golf_ball: "#f43f5e",
  player_ready: "#a3e635",
  player_not_ready: "#fb7185",
};

const labelColor = (label: string) => LABEL_COLORS[label] ?? "#f8fafc";

const formatMs = (value: number) => `${Math.round(value)}ms`;

type Point = { x: number; y: number };
type EndpointTrackPoint = Point & { frame: number; timeMs: number; confidence: number };
type OverlayOptions = {
  boxes: boolean;
  labels: boolean;
  endpoints: boolean;
  trajectory: boolean;
  events: boolean;
  pose: boolean;
};

function getInitialJobId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("jobId") ?? "";
}

function frameBoxStyle(
  bbox: [number, number, number, number],
  meta: InferDebugFramesResponse["meta"]
) {
  let [x, y, width, height] = bbox;
  if ((x > 1 || y > 1 || width > 1 || height > 1) && meta.width && meta.height) {
    x /= meta.width;
    width /= meta.width;
    y /= meta.height;
    height /= meta.height;
  }
  return {
    left: `${Math.max(0, x) * 100}%`,
    top: `${Math.max(0, y) * 100}%`,
    width: `${Math.max(0, width) * 100}%`,
    height: `${Math.max(0, height) * 100}%`,
  };
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

function clubBoxEndpoints(det: DebugDetection, meta: InferDebugFramesResponse["meta"]): [Point, Point] {
  const [x, y, width, height] = normalizeBox(det.bbox, meta);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  if (width >= height) {
    return [
      { x, y: centerY },
      { x: x + width, y: centerY },
    ];
  }
  return [
    { x: centerX, y },
    { x: centerX, y: y + height },
  ];
}

function endpointTrackScore(points: EndpointTrackPoint[]) {
  if (points.length < 2) return 0;
  let travel = 0;
  for (let idx = 1; idx < points.length; idx += 1) {
    travel += Math.hypot(points[idx].x - points[idx - 1].x, points[idx].y - points[idx - 1].y);
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return travel + Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function buildClubEndpointTrack(
  frames: InferDebugFramesResponse["frames"],
  meta: InferDebugFramesResponse["meta"],
  threshold: number
): EndpointTrackPoint[] {
  const candidates: [EndpointTrackPoint[], EndpointTrackPoint[]] = [[], []];
  frames.forEach((frame) => {
    const club = frame.detections
      .filter((det) => det.label === "club" && det.confidence >= threshold)
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (!club) return;
    const endpoints = clubBoxEndpoints(club, meta);
    endpoints.forEach((point, idx) => {
      candidates[idx].push({
        ...point,
        frame: frame.frame,
        timeMs: frame.timeMs,
        confidence: club.confidence,
      });
    });
  });
  return endpointTrackScore(candidates[0]) >= endpointTrackScore(candidates[1])
    ? candidates[0]
    : candidates[1];
}

function pathFromPoints(points: Point[]) {
  return points
    .map((point, idx) => `${idx === 0 ? "M" : "L"} ${(point.x * 100).toFixed(2)} ${(point.y * 100).toFixed(2)}`)
    .join(" ");
}

function extractEvents(analysis: InferDebugAnalysisResponse | null) {
  const events = analysis?.analysis?.events ?? {};
  const valueFor = (name: "address" | "top" | "impact" | "finish") => {
    const direct = events[`${name}Ms`];
    const nested = events[name];
    if (typeof direct === "number") return direct;
    if (nested && typeof nested === "object" && "timeMs" in nested && typeof nested.timeMs === "number") {
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

function nearestEventLabel(events: ReturnType<typeof extractEvents>, timeMs: number, toleranceMs: number) {
  const matches = Object.entries(events)
    .filter(([, value]) => typeof value === "number")
    .map(([label, value]) => ({ label, delta: Math.abs(timeMs - Number(value)) }))
    .filter((item) => item.delta <= toleranceMs)
    .sort((a, b) => a.delta - b.delta);
  return matches[0]?.label ?? null;
}

export function InferDebugPage() {
  const [jobId, setJobId] = useState(getInitialJobId);
  const [limit, setLimit] = useState(24);
  const [variant, setVariant] = useState<"main" | "debug">("main");
  const [threshold, setThreshold] = useState(0.25);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [showAllLabels, setShowAllLabels] = useState(true);
  const [overlayOptions, setOverlayOptions] = useState<OverlayOptions>({
    boxes: true,
    labels: true,
    endpoints: true,
    trajectory: true,
    events: true,
    pose: true,
  });
  const [data, setData] = useState<InferDebugFramesResponse | null>(null);
  const [analysis, setAnalysis] = useState<InferDebugAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingDebug, setIsGeneratingDebug] = useState(false);

  const labels = useMemo(() => {
    const found = new Set<string>();
    data?.frames.forEach((frame) => {
      frame.detections.forEach((det) => found.add(det.label));
    });
    return [...found].sort();
  }, [data]);

  const summary = useMemo(() => {
    if (!data) return null;
    const frames = data.frames.length;
    const detections = data.frames.reduce((sum, frame) => sum + frame.detections.length, 0);
    const handleFrames = data.frames.filter((frame) =>
      frame.detections.some((det) => det.label === "club_handle")
    ).length;
    const headFrames = data.frames.filter((frame) =>
      frame.detections.some((det) => det.label === "club_head")
    ).length;
    return { frames, detections, handleFrames, headFrames };
  }, [data]);

  const poseSummary = useMemo(() => {
    const frames = data?.frames.filter((frame) => frame.keypoints && Object.keys(frame.keypoints).length > 0).length ?? 0;
    const wristFrames =
      data?.frames.filter((frame) => {
        const left = frame.keypoints?.left_wrist;
        const right = frame.keypoints?.right_wrist;
        return Boolean((left && left[2] >= 0.25) || (right && right[2] >= 0.25));
      }).length ?? 0;
    return { frames, wristFrames };
  }, [data]);

  const endpointTrack = useMemo(() => {
    if (!data) return [];
    return buildClubEndpointTrack(data.frames, data.meta, threshold);
  }, [data, threshold]);

  const events = useMemo(() => extractEvents(analysis), [analysis]);

  const eventToleranceMs = useMemo(() => {
    if (!data || data.frames.length < 2) return 40;
    const deltas = data.frames
      .slice(1)
      .map((frame, idx) => Math.abs(frame.timeMs - data.frames[idx].timeMs))
      .filter((value) => Number.isFinite(value) && value > 0);
    return Math.max(35, Math.min(90, (deltas[0] ?? 70) * 0.65));
  }, [data]);

  const load = async (force = false) => {
    return loadVariant(variant, force);
  };

  const loadVariant = async (targetVariant: "main" | "debug", force = false) => {
    const trimmed = jobId.trim();
    if (!trimmed) {
      setError("jobId를 입력하세요.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [next, nextAnalysis] = await Promise.all([
        fetchInferDebugFrames(trimmed, { limit, force, variant: targetVariant }),
        fetchInferDebugAnalysis(trimmed).catch(() => null),
      ]);
      setData(next);
      setAnalysis(nextAnalysis);
      setVariant(targetVariant);
      const nextLabels = new Set<string>();
      next.frames.forEach((frame) => {
        frame.detections.forEach((det) => nextLabels.add(det.label));
      });
      setSelectedLabels(nextLabels);
      setShowAllLabels(true);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("jobId", trimmed);
        window.history.replaceState(null, "", url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "debug frame을 불러오지 못했습니다.");
      setData(null);
      setAnalysis(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateDebugMeta = async () => {
    const trimmed = jobId.trim();
    if (!trimmed) {
      setError("jobId를 입력하세요.");
      return;
    }
    setIsGeneratingDebug(true);
    setError(null);
    try {
      await generateInferDebugMeta(trimmed);
      await loadVariant("debug", true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "debug meta를 생성하지 못했습니다.");
    } finally {
      setIsGeneratingDebug(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    load(false);
  };

  const toggleLabel = (label: string) => {
    setShowAllLabels(false);
    setSelectedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const visibleDetections = (frame: InferDebugFramesResponse["frames"][number]) =>
    frame.detections.filter((det) => {
      if (det.confidence < threshold) return false;
      if (showAllLabels) return true;
      return selectedLabels.has(det.label);
    });

  const toggleOverlay = (key: keyof OverlayOptions) => {
    setOverlayOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              infer debug
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Service7 Frame Overlay
            </h1>
          </div>
          <form className="grid gap-2 sm:grid-cols-[minmax(18rem,1fr)_6rem_7rem_auto_auto]" onSubmit={handleSubmit}>
            <Input
              value={jobId}
              onChange={(event) => setJobId(event.target.value)}
              placeholder="jobId"
              aria-label="jobId"
            />
            <Input
              type="number"
              min={4}
              max={48}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              aria-label="sample limit"
            />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={variant}
              onChange={(event) => setVariant(event.target.value === "debug" ? "debug" : "main")}
              aria-label="meta variant"
            >
              <option value="main">main</option>
              <option value="debug">debug</option>
            </select>
            <Button fullWidth={false} className="px-4 py-2 text-sm" type="submit" isLoading={isLoading}>
              <span className="inline-flex items-center gap-2">
                <Search className="h-4 w-4" />
                Load
              </span>
            </Button>
            <Button
              fullWidth={false}
              variant="outline"
              className="px-4 py-2 text-sm"
              type="button"
              disabled={isLoading || !data}
              onClick={() => load(true)}
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </span>
            </Button>
            <Button
              fullWidth={false}
              variant="outline"
              className="px-4 py-2 text-sm sm:col-start-4"
              type="button"
              disabled={isLoading || isGeneratingDebug}
              isLoading={isGeneratingDebug}
              loadingText="Generating..."
              onClick={handleGenerateDebugMeta}
            >
              Debug Meta
            </Button>
          </form>
        </header>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {data && summary && (
          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">
                  Detection Summary {data.variant ? `(${data.variant})` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-6">
                {[
                  ["Frames", summary.frames],
                  ["Detections", summary.detections],
                  ["Club Head", summary.headFrames],
                  ["Club Handle", summary.handleFrames],
                  ["Pose", data.body?.poseFrames ?? poseSummary.frames],
                  ["Wrist", data.body?.wristFrames ?? poseSummary.wristFrames],
                  ["Endpoint Pts", endpointTrack.length],
                  ["Motion", String(analysis?.analysis?.debug?.motionSource ?? "n/a")],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 truncate text-2xl font-semibold">{value}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Filter className="h-4 w-4" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="block text-xs font-medium text-muted-foreground">
                  Confidence {threshold.toFixed(2)}
                </label>
                <input
                  className="w-full accent-primary"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={threshold}
                  onChange={(event) => setThreshold(Number(event.target.value))}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAllLabels(true)}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      showAllLabels ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    }`}
                  >
                    all
                  </button>
                  {labels.map((label) => (
                    <button
                      type="button"
                      key={label}
                      onClick={() => toggleLabel(label)}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        !showAllLabels && selectedLabels.has(label)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="border-t border-border pt-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Overlay Layers</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["boxes", "bbox"],
                      ["labels", "labels"],
                      ["endpoints", "keys"],
                      ["trajectory", "path"],
                      ["events", "events"],
                      ["pose", "pose"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleOverlay(key as keyof OverlayOptions)}
                        className={`rounded-md border px-2 py-1 text-xs ${
                          overlayOptions[key as keyof OverlayOptions]
                            ? "border-cyan-300 bg-cyan-300 text-slate-950"
                            : "border-border"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {data && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.frames.map((frame) => {
              const detections = visibleDetections(frame);
              const eventLabel = nearestEventLabel(events, frame.timeMs, eventToleranceMs);
              const currentEndpoint = endpointTrack.find((point) => point.frame === frame.frame);
              const trajectoryPath = pathFromPoints(endpointTrack);
              const clubHeadPoints = detections
                .filter((det) => det.label === "club_head")
                .map((det) => boxCenter(det, data.meta));
              const keypoint = (name: string) => {
                const value = frame.keypoints?.[name];
                if (!value || value.length < 2 || value[2] < 0.25) return null;
                return { x: value[0], y: value[1], confidence: value[2] };
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
              const posePoints = [
                "nose",
                "left_shoulder",
                "right_shoulder",
                "left_elbow",
                "right_elbow",
                "left_wrist",
                "right_wrist",
                "left_hip",
                "right_hip",
              ]
                .map((name) => ({ name, point: keypoint(name) }))
                .filter((item): item is { name: string; point: Point & { confidence: number } } => Boolean(item.point));
              return (
                <article key={`${frame.index}-${frame.timeMs}`} className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
                    <span>frame {frame.frame}</span>
                    <span className="inline-flex items-center gap-2">
                      {eventLabel && overlayOptions.events && (
                        <span className="rounded-full bg-cyan-300 px-2 py-0.5 font-semibold text-slate-950">
                          {eventLabel}
                        </span>
                      )}
                      {formatMs(frame.timeMs)}
                    </span>
                  </div>
                  <div className="relative bg-black">
                    <img className="block w-full" src={frame.imageUrl} alt={`frame ${frame.frame}`} loading="lazy" />
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      {overlayOptions.trajectory && trajectoryPath && (
                        <>
                          <path
                            d={trajectoryPath}
                            fill="none"
                            stroke="rgba(34, 211, 238, 0.32)"
                            strokeDasharray="1.6 1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="0.7"
                          />
                          {endpointTrack.map((point) => (
                            <circle
                              key={`${point.frame}-${point.timeMs}`}
                              cx={point.x * 100}
                              cy={point.y * 100}
                              r={point.frame === frame.frame ? 1.35 : 0.55}
                              fill={point.frame === frame.frame ? "#22d3ee" : "rgba(34, 211, 238, 0.5)"}
                              stroke={point.frame === frame.frame ? "#0f172a" : "none"}
                              strokeWidth="0.35"
                            />
                          ))}
                        </>
                      )}
                      {overlayOptions.endpoints && currentEndpoint && (
                        <circle
                          cx={currentEndpoint.x * 100}
                          cy={currentEndpoint.y * 100}
                          r="2.0"
                          fill="#22d3ee"
                          stroke="#020617"
                          strokeWidth="0.45"
                        />
                      )}
                      {overlayOptions.endpoints &&
                        clubHeadPoints.map((point, idx) => (
                          <circle
                            key={`head-${idx}`}
                            cx={point.x * 100}
                            cy={point.y * 100}
                            r="1.65"
                            fill="#22c55e"
                            stroke="#020617"
                            strokeWidth="0.4"
                          />
                        ))}
                      {overlayOptions.events && eventLabel && (
                        <rect
                          x="1.5"
                          y="1.5"
                          width="97"
                          height="97"
                          fill="none"
                          stroke="#22d3ee"
                          strokeDasharray="2 1.4"
                          strokeWidth="0.8"
                        />
                      )}
                      {overlayOptions.pose &&
                        poseSegments.map(([from, to], idx) =>
                          from && to ? (
                            <line
                              key={`pose-line-${idx}`}
                              x1={from.x * 100}
                              y1={from.y * 100}
                              x2={to.x * 100}
                              y2={to.y * 100}
                              stroke="rgba(250, 204, 21, 0.72)"
                              strokeLinecap="round"
                              strokeWidth="0.7"
                            />
                          ) : null
                        )}
                      {overlayOptions.pose &&
                        posePoints.map(({ name, point }) => (
                          <circle
                            key={`pose-${name}`}
                            cx={point.x * 100}
                            cy={point.y * 100}
                            r={name.endsWith("wrist") ? 1.5 : 0.95}
                            fill={name.endsWith("wrist") ? "#facc15" : "#fde68a"}
                            stroke="#020617"
                            strokeWidth="0.35"
                          />
                        ))}
                    </svg>
                    {overlayOptions.boxes && detections.map((det, idx) => {
                      const color = labelColor(det.label);
                      return (
                        <div
                          key={`${det.label}-${idx}`}
                          className="pointer-events-none absolute border-2"
                          style={{ ...frameBoxStyle(det.bbox, data.meta), borderColor: color }}
                        >
                          {overlayOptions.labels && (
                            <span
                              className="absolute left-0 top-0 max-w-full -translate-y-full truncate px-1 py-0.5 text-[10px] font-semibold text-black"
                              style={{ backgroundColor: color }}
                            >
                              {det.label} {det.confidence.toFixed(2)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2 px-3 py-2 text-xs text-muted-foreground">
                    {detections.length ? (
                      detections.map((det, idx) => (
                        <span key={`${det.label}-chip-${idx}`} className="rounded border border-border px-2 py-1">
                          {det.label} {det.confidence.toFixed(2)}
                        </span>
                      ))
                    ) : (
                      <span>no detections</span>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
