import { FormEvent, useMemo, useState } from "react";
import { Filter, RefreshCw, Search } from "lucide-react";
import { fetchInferDebugFrames, InferDebugFramesResponse } from "../../api/debug";
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

export function InferDebugPage() {
  const [jobId, setJobId] = useState(getInitialJobId);
  const [limit, setLimit] = useState(24);
  const [threshold, setThreshold] = useState(0.25);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [showAllLabels, setShowAllLabels] = useState(true);
  const [data, setData] = useState<InferDebugFramesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const load = async (force = false) => {
    const trimmed = jobId.trim();
    if (!trimmed) {
      setError("jobId를 입력하세요.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const next = await fetchInferDebugFrames(trimmed, { limit, force });
      setData(next);
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
    } finally {
      setIsLoading(false);
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
          <form className="grid gap-2 sm:grid-cols-[minmax(18rem,1fr)_6rem_auto_auto]" onSubmit={handleSubmit}>
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
                <CardTitle className="text-base">Detection Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Frames", summary.frames],
                  ["Detections", summary.detections],
                  ["Club Head", summary.headFrames],
                  ["Club Handle", summary.handleFrames],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 text-2xl font-semibold">{value}</div>
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
              </CardContent>
            </Card>
          </section>
        )}

        {data && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.frames.map((frame) => {
              const detections = visibleDetections(frame);
              return (
                <article key={`${frame.index}-${frame.timeMs}`} className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
                    <span>frame {frame.frame}</span>
                    <span>{formatMs(frame.timeMs)}</span>
                  </div>
                  <div className="relative bg-black">
                    <img className="block w-full" src={frame.imageUrl} alt={`frame ${frame.frame}`} loading="lazy" />
                    {detections.map((det, idx) => {
                      const color = labelColor(det.label);
                      return (
                        <div
                          key={`${det.label}-${idx}`}
                          className="pointer-events-none absolute border-2"
                          style={{ ...frameBoxStyle(det.bbox, data.meta), borderColor: color }}
                        >
                          <span
                            className="absolute left-0 top-0 max-w-full -translate-y-full truncate px-1 py-0.5 text-[10px] font-semibold text-black"
                            style={{ backgroundColor: color }}
                          >
                            {det.label} {det.confidence.toFixed(2)}
                          </span>
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
