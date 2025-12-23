import { client, API_BASE } from "./client";
import {
  AnalysisResult,
  BallMetrics,
  EventTimingMetrics,
  JobStatus,
  PendingMetric,
  Shot,
  SourceType,
  SwingEventKey,
  SwingEventTiming,
  TempoMetrics,
} from "../types/shots";

type UploadRes = {
  ok?: boolean;
  jobId?: string;
  filename?: string;
  url?: string;
  originalName?: string;
  file?: { filename?: string; url?: string; originalName?: string };
  shot?: { id?: string; filename?: string; url?: string; originalName?: string; jobId?: string; status?: JobStatus };
  shotId?: string;
  status?: JobStatus;
  analysis?: any;
  error?: string;
};
type FilesDetailRes = {
  ok: boolean;
  files: Array<{
    filename: string;
    url?: string;
    shotId?: string;
    jobId?: string;
    analyzed?: boolean;
    status?: JobStatus;
    size?: number;
    modifiedAt?: string;
    analysis?: any;
    errorCode?: string | null;
    errorMessage?: string | null;
  }>;
};

const PENDING_METRICS: PendingMetric[] = [
  {
    key: "clubPath",
    label: "Club Path",
    description: "YOLO 기반 클럽 헤드 트래킹 고도화 후 제공 예정입니다.",
    status: "coming-soon",
  },
  {
    key: "swingPlane",
    label: "Swing Plane",
    description: "샤프트/헤드 감지를 안정화한 뒤 활성화됩니다.",
    status: "coming-soon",
  },
  {
    key: "attackAngle",
    label: "Attack Angle",
    description: "단일 카메라에서 신뢰도 확보 후 표시할 예정입니다.",
    status: "coming-soon",
  },
];

const resolveFilename = (input: any): string => {
  if (!input) return "";
  if (typeof input === "string") return input;
  return (
    input.filename ||
    input.file?.filename ||
    input.shot?.filename ||
    input.media?.filename ||
    input.fileName ||
    input.name ||
    ""
  );
};

const resolveUrl = (rawUrl: any): string => {
  if (!rawUrl) return "";
  if (typeof rawUrl === "string") return rawUrl;
  return rawUrl.url || rawUrl.file?.url || rawUrl.shot?.url || "";
};

const resolveOriginalName = (input: any): string => {
  if (!input) return "";
  if (typeof input === "string") return input;
  return input.originalName || input.file?.originalName || input.shot?.originalName || "";
};

const toTime = (value: any): number => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const ts = Date.parse(String(value));
  return Number.isFinite(ts) ? ts : 0;
};

const sortByModifiedDesc = <T extends { modifiedAt?: string; createdAt?: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    const bt = toTime(b.modifiedAt ?? b.createdAt);
    const at = toTime(a.modifiedAt ?? a.createdAt);
    if (bt !== at) return bt - at;
    return String(b.modifiedAt ?? b.createdAt ?? "").localeCompare(String(a.modifiedAt ?? a.createdAt ?? ""));
  });
};

const isVideoFile = (filename: string) => {
  const lower = filename.toLowerCase();
  return lower.endsWith(".mp4") || lower.endsWith(".mov");
};

const resolveMediaUrl = (url: string | undefined, filename: string): string => {
  if (url && typeof url === "string") {
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("/")) return `${API_BASE}${url}`;
    return `${API_BASE}/${url}`;
  }
  return `${API_BASE}/uploads/${encodeURIComponent(filename)}`;
};

const toNumberOrNull = (value: any): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeEvents = (events: any): Partial<Record<SwingEventKey, SwingEventTiming>> => {
  const keys: SwingEventKey[] = ["address", "top", "impact", "finish"];
  if (!events || typeof events !== "object") return {};

  const toMsValue = (key: SwingEventKey) => {
    const direct = events[key];
    if (direct != null) return direct;
    const camel = events[`${key}Ms`];
    if (camel != null) return camel;
    const snake = events[`${key}_ms`];
    if (snake != null) return snake;
    return null;
  };

  return keys.reduce((acc, key) => {
    const raw = toMsValue(key);
    if (raw == null) return acc;

    if (typeof raw === "number") {
      acc[key] = { timeMs: raw };
      return acc;
    }

    if (typeof raw === "object") {
      const timeMs = toNumberOrNull(raw.timeMs ?? raw.ms ?? raw.time);
      if (timeMs == null) return acc;
      acc[key] = {
        timeMs,
        frame: toNumberOrNull(raw.frame ?? raw.frameIndex) ?? undefined,
        label: raw.label ?? key,
      };
    }

    return acc;
  }, {} as Partial<Record<SwingEventKey, SwingEventTiming>>);
};

const normalizeTempo = (metrics: any): TempoMetrics | undefined => {
  const tempo = metrics?.tempo ?? metrics;
  if (!tempo || typeof tempo !== "object") return undefined;

  const backswing = tempo.backswingMs ?? tempo.backswing_ms ?? tempo.backswing_time_ms;
  const downswing = tempo.downswingMs ?? tempo.downswing_ms ?? tempo.downswing_time_ms;
  const ratio = tempo.ratio ?? tempo.tempo_ratio ?? tempo.backswing_to_downswing_ratio;

  if (backswing == null && downswing == null && ratio == null) return undefined;

  return {
    backswingMs: toNumberOrNull(backswing),
    downswingMs: toNumberOrNull(downswing),
    ratio: ratio != null ? String(ratio) : null,
  };
};

const normalizeJobStatus = (status: any): JobStatus => {
  if (!status || typeof status !== "string") return "queued";
  switch (status.toLowerCase()) {
    case "pending":
      return "queued";
    case "done":
      return "succeeded";
    case "success":
    case "succeeded":
      return "succeeded";
    case "running":
      return "running";
    case "failed":
      return "failed";
    case "queued":
      return "queued";
    default:
      return "queued";
  }
};

const deriveSpeedRelative = (initialVelocity: any): BallMetrics["speedRelative"] => {
  const value = toNumberOrNull(initialVelocity);
  if (value == null) return undefined;
  if (value >= 0.7) return "fast";
  if (value >= 0.4) return "medium";
  return "slow";
};

const deriveLaunchDirection = (dir: any): BallMetrics["launchDirection"] => {
  if (dir == null) return undefined;
  if (typeof dir === "string") {
    const normalized = dir.toLowerCase();
    if (normalized.includes("left") || normalized.includes("pull") || normalized.includes("hook")) {
      return "left";
    }
    if (normalized.includes("right") || normalized.includes("push") || normalized.includes("slice")) {
      return "right";
    }
    return "center";
  }
  const num = toNumberOrNull(dir);
  if (num == null) return undefined;
  if (num > 1) return "right";
  if (num < -1) return "left";
  return "center";
};

const normalizeBall = (metrics: any): BallMetrics | undefined => {
  const ball = metrics?.ball ?? metrics;
  if (!ball || typeof ball !== "object") return undefined;

  const launchDirection =
    ball.launchDirection ??
    ball.launch_direction ??
    ball.horizontal_launch_direction ??
    deriveLaunchDirection(ball);
  const launchAngle =
    toNumberOrNull(ball.launchAngle ?? ball.launch_angle ?? ball.vertical_launch_angle) ?? null;
  const speedRelative =
    ball.speedRelative ??
    ball.speed_relative ??
    ball.speed_category ??
    deriveSpeedRelative(ball.initial_velocity) ??
    ("unknown" as const);

  if (launchDirection || launchAngle != null || speedRelative) {
    return {
      launchDirection: (launchDirection as BallMetrics["launchDirection"]) ?? "unknown",
      launchAngle,
      speedRelative,
    };
  }
  return undefined;
};

const deriveEventTiming = (
  metrics: any,
  events: Partial<Record<SwingEventKey, SwingEventTiming>>
): EventTimingMetrics | undefined => {
  const fromMetrics = metrics?.eventTiming ?? metrics?.event_timing;
  if (fromMetrics && typeof fromMetrics === "object") {
    return fromMetrics as EventTimingMetrics;
  }

  const derived: EventTimingMetrics = {};
  Object.entries(events).forEach(([key, value]) => {
    if (value?.timeMs != null) {
      derived[key as SwingEventKey] = value.timeMs;
    }
  });
  return Object.keys(derived).length > 0 ? derived : undefined;
};

const normalizeAnalysis = (
  raw: any,
  jobId: string,
  status: JobStatus = "succeeded"
): AnalysisResult => {
  const metricsBlock = raw?.metrics ?? raw;
  const events = normalizeEvents(raw?.events ?? metricsBlock?.events ?? raw);
  const tempo = normalizeTempo(metricsBlock);
  const eventTiming = deriveEventTiming(metricsBlock, events);
  const ball = normalizeBall(metricsBlock);
  const swingPlaneRaw =
    metricsBlock?.swingPlane ?? metricsBlock?.swing_plane ?? raw?.swingPlane ?? raw?.swing_plane;
  const impactStabilityRaw =
    metricsBlock?.impactStability ??
    metricsBlock?.impact_stability ??
    raw?.impactStability ??
    raw?.impact_stability;
  const formatScore = (value: number | null | undefined) =>
    value == null || Number.isNaN(value) ? null : `${Math.round(value * 100)}%`;
  const toText = (value: any): string | null => {
    if (value == null) return null;
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (typeof value === "object") {
      const label = value.label ?? value.name ?? value.type;
      const score =
        typeof value.confidence === "number"
          ? formatScore(value.confidence)
          : typeof value.score === "number"
          ? formatScore(value.score)
          : null;
      if (typeof label === "string" && score) return `${label} (${score})`;
      if (typeof label === "string") return label;
    }
    return null;
  };
  const summary =
    (typeof raw?.summary === "string" && raw.summary) ||
    (typeof metricsBlock?.summary === "string" && metricsBlock.summary) ||
    (typeof raw?.coach_summary === "string" && raw.coach_summary) ||
    (typeof raw?.coachSummary === "string" && raw.coachSummary) ||
    null;
  const coachSummary =
    (Array.isArray(raw?.coach_summary) && raw.coach_summary) ||
    (Array.isArray(raw?.coachSummary) && raw.coachSummary) ||
    (Array.isArray(raw?.coach_comments) && raw.coach_comments) ||
    (Array.isArray(raw?.coachComments) && raw.coachComments) ||
    undefined;

  return {
    jobId,
    status,
    events,
    metrics: {
      tempo,
      eventTiming,
      ball,
      swingPlane: toText(swingPlaneRaw),
      impactStability: toText(impactStabilityRaw),
    },
    pending: [...PENDING_METRICS],
    createdAt: raw?.createdAt ?? raw?.created_at,
    finishedAt: raw?.finishedAt ?? raw?.finished_at,
    errorMessage: raw?.errorMessage ?? raw?.error,
    summary,
    coachSummary,
  };
};

const withVideoUrl = (shot: Shot): Shot => {
  const filename = resolveFilename(shot);
  return {
    ...shot,
    filename,
    videoUrl: resolveMediaUrl(shot.videoUrl, filename),
  };
};

const mapToShot = (item: any): Shot => {
  const filename = resolveFilename(item);
  const jobId = item?.jobId ?? item?.analysis?.jobId ?? item?.id ?? filename;
  const analyzedFlag =
    item?.analyzed ?? Boolean(item?.analysis) ?? item?.status === "succeeded";
  const normalizedStatus: JobStatus | undefined =
    item?.status === "completed" ? "succeeded" : item?.status;
  const analysis = item?.analysis
    ? normalizeAnalysis(item.analysis, jobId, item.analysis.status ?? normalizedStatus)
    : null;

  return withVideoUrl({
    id: item?.id ?? jobId ?? filename,
    filename,
    jobId,
    sourceType: (item?.sourceType as SourceType) ?? "upload",
    videoUrl: resolveUrl(item) || item?.url,
    originalName: resolveOriginalName(item) || undefined,
    createdAt: item?.createdAt ?? item?.uploadedAt ?? new Date().toISOString(),
    status: normalizedStatus ?? analysis?.status,
    analyzed: analyzedFlag,
    modifiedAt: item?.modifiedAt,
    size: item?.size,
    errorCode: item?.errorCode ?? item?.analysis?.errorCode ?? null,
    errorMessage: item?.errorMessage ?? item?.analysis?.errorMessage ?? null,
    club: item?.club,
    analysis,
  } as Shot);
};

export const fetchShots = async (): Promise<Shot[]> => {
  // 1) /api/files/detail (확장 스펙)
  try {
    const detail = await client.get<FilesDetailRes>("/api/files/detail");
    if (detail && Array.isArray(detail.files)) {
      const sorted = sortByModifiedDesc(detail.files);
      return sorted
        .filter((f) => typeof f.filename === "string" && isVideoFile(f.filename))
        .map((f) =>
          mapToShot({
            id: f.shotId || f.filename,
            filename: f.filename,
            createdAt: f.modifiedAt || new Date().toISOString(),
            url: f.url,
            jobId: f.jobId,
            analyzed: f.analyzed,
            status: f.status,
            analysis: f.analysis,
            size: f.size,
            modifiedAt: f.modifiedAt,
            errorCode: f.errorCode,
            errorMessage: f.errorMessage,
          })
        )
        .sort((a, b) => toTime(b.modifiedAt ?? b.createdAt) - toTime(a.modifiedAt ?? a.createdAt));
    }
  } catch (err) {
    console.warn("fetchShots /api/files/detail failed, fallback to /api/files", err);
  }

  // 2) 우선순위: /api/files (기존)
  try {
    const data = await client.get<unknown>("/api/files");
    if (Array.isArray(data)) {
      const mapped = (data as any[])
        .filter((entry) => {
          const filename = typeof entry === "string" ? entry : entry?.filename;
          return typeof filename === "string" && isVideoFile(filename);
        })
        .map((entry) =>
          typeof entry === "string" ? mapToShot({ filename: entry }) : mapToShot(entry)
        );
      return mapped.sort((a, b) => toTime(b.modifiedAt ?? b.createdAt) - toTime(a.modifiedAt ?? a.createdAt));
    }
  } catch (err) {
    console.warn("fetchShots /api/files failed, fallback to legacy", err);
  }

  // 3) 레거시: /api/shots
  try {
    const data = await client.get<unknown>("/api/shots");
    if (Array.isArray(data)) {
      return (data as any[]).map((entry) => mapToShot(entry));
    }
  } catch (err) {
    console.error("fetchShots /api/shots failed", err);
  }

  return [];
};

export const fetchShot = async (id: string): Promise<Shot> => {
  try {
    const shot = await client.get<Shot>(`/api/shots/${encodeURIComponent(id)}`);
    return mapToShot(shot);
  } catch {
    return mapToShot({
      id,
      filename: id,
      sourceType: "upload",
      createdAt: new Date().toISOString(),
    });
  }
};

export const createAnalysisJob = async (
  file: File,
  sourceType: SourceType = "upload",
  options?: {
    club?: string;
    fps?: number;
    roi?: string;
    cam_distance?: number;
    cam_height?: number;
    h_fov?: number;
    v_fov?: number;
    impact_frame?: number;
    track_frames?: number;
  }
): Promise<Shot> => {
  const fd = new FormData();
  fd.append("video", file);
  fd.append("sourceType", sourceType);
  if (options?.club) fd.append("club", options.club);
  if (options?.fps != null) fd.append("fps", String(options.fps));
  if (options?.roi) fd.append("roi", options.roi);
  if (options?.cam_distance != null) fd.append("cam_distance", String(options.cam_distance));
  if (options?.cam_height != null) fd.append("cam_height", String(options.cam_height));
  if (options?.h_fov != null) fd.append("h_fov", String(options.h_fov));
  if (options?.v_fov != null) fd.append("v_fov", String(options.v_fov));
  if (options?.impact_frame != null) fd.append("impact_frame", String(options.impact_frame));
  if (options?.track_frames != null) fd.append("track_frames", String(options.track_frames));

  const send = async (url: string) => client.post<UploadRes>(url, fd);

  let res: UploadRes;
  try {
    res = await send("/api/analyze");
  } catch (primaryError) {
    console.warn("createAnalysisJob: /api/analyze failed, fallback to /api/upload?analyze=true", primaryError);
    res = await send("/api/upload?analyze=true");
  }

  if (res.ok === false) {
    throw new Error(res.error || "업로드/분석 요청 실패");
  }

  const filename = resolveFilename(res) || file.name;
  const url = resolveUrl(res) || res.url || res.file?.url || res.shot?.url;
  const originalName = resolveOriginalName(res) || file.name;
  const jobId = res.jobId ?? res.shot?.jobId ?? res.shotId ?? filename;
  const analysis = res.analysis
    ? normalizeAnalysis(res.analysis, jobId, res.analysis.status ?? res.status)
    : null;

  return mapToShot({
    id: res.shotId ?? res.shot?.id ?? jobId ?? filename,
    filename,
    url,
    originalName,
    jobId,
    sourceType,
    status: res.status ?? res.shot?.status ?? analysis?.status ?? "queued",
    createdAt: new Date().toISOString(),
    analysis,
  });
};

export const fetchAnalysisStatus = async (
  jobId: string
): Promise<{ jobId: string; status: JobStatus; analysis?: AnalysisResult | null; errorMessage?: string }> => {
  try {
    const res = await client.get<any>(`/api/analyze/${encodeURIComponent(jobId)}`);
    const status = normalizeJobStatus(res.status);
    const analysis = normalizeAnalysis(res, res.jobId ?? jobId, status);
    return {
      jobId: res.jobId ?? jobId,
      status,
      analysis,
      errorMessage: res.errorMessage ?? res.error ?? res.message,
    };
  } catch (err) {
    console.warn("fetchAnalysisStatus failed", err);
    throw err;
  }
};

export const fetchAnalysisResult = async (jobId: string): Promise<AnalysisResult | null> => {
  try {
    const result = await client.get<any>(`/api/analyze/${encodeURIComponent(jobId)}`);
    if (!result) return null;
    const status = normalizeJobStatus(result.status);
    return normalizeAnalysis(result, jobId, status);
  } catch (err) {
    console.warn("fetchAnalysisResult failed (ignored):", err);
    return null;
  }
};

// 호환성을 위해 유지
export const fetchAnalysis = fetchAnalysisResult;
export const createShot = createAnalysisJob;

export const createAnalysisJobFromFile = async (
  filename: string,
  options?: { force?: boolean; jobId?: string }
): Promise<{ jobId: string; filename: string; status?: JobStatus }> => {
  const derivedJobId = options?.jobId ?? filename.replace(/\.[^.]+$/, "");
  const res = await fetch(`${API_BASE}/api/analyze/from-file`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jobId: derivedJobId,
      filename,
      ...(options?.force ? { force: true } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || res.statusText);
  }
  const json = (await res.json()) as {
    jobId: string;
    filename: string;
    status?: string;
    ok?: boolean;
    error?: string;
  };
  if (json.ok === false) {
    throw new Error(json.error || "분석을 시작하지 못했습니다.");
  }
  return {
    jobId: json.jobId ?? derivedJobId,
    filename: json.filename ?? filename,
    status: normalizeJobStatus(json.status),
  };
};
