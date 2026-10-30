import { ApiError, client, API_BASE } from "./client";
import {
  AnalysisMetricDetail,
  AnalysisProgress,
  AnalysisOverlay,
  AnalysisResult,
  BallMetrics,
  BackswingMetrics,
  CoachFinding,
  DtlClubPointsV2Sidecar,
  ClubObservationLevel,
  EventEvidenceQuality,
  EventTimingMetrics,
  EventValidation,
  GenericMetricPayload,
  JobStatus,
  MetricGroup,
  NasArchiveStatus,
  PendingMetric,
  ReadinessMetrics,
  Shot,
  ShaftPlaneMetrics,
  SourceType,
  SwingEventKey,
  SwingEventTiming,
  TempoMetrics,
  TrackingQualityMetrics,
} from "../types/shots";

type UploadRes = {
  ok?: boolean;
  jobId?: string;
  filename?: string;
  url?: string;
  originalName?: string;
  file?: string | { filename?: string; url?: string; originalName?: string };
  shot?: { id?: string; filename?: string; url?: string; originalName?: string; jobId?: string; status?: JobStatus };
  shotId?: string;
  status?: string;
  analysis?: any;
  progress?: any;
  error?: string;
  errorMessage?: string;
  message?: string;
};
type FilesDetailRes = {
  ok: boolean;
  files: Array<{
    filename: string;
    url?: string;
    shotId?: string;
    jobId?: string;
    sourceType?: SourceType | null;
    analyzed?: boolean;
    status?: JobStatus;
    size?: number;
    modifiedAt?: string;
    metaPath?: string | null;
    thumbnailUrl?: string | null;
    analysis?: any;
    progress?: any;
    errorCode?: string | null;
    errorMessage?: string | null;
    nasArchive?: NasArchiveStatus | null;
  }>;
};

const isFallbackableApiError = (error: unknown): boolean => {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 404 || error.status === 405) return true;
  if (typeof error.body !== "string") return false;
  const normalized = error.body.trim().toLowerCase();
  return normalized.startsWith("<!doctype html") || normalized.startsWith("<html");
};

const PENDING_METRICS: PendingMetric[] = [
  {
    key: "pelvisPose",
    label: "Pelvis Rotation",
    description: "골반 회전은 포즈 키포인트 모델 연동 후 직접 판정합니다.",
    status: "coming-soon",
  },
  {
    key: "attackAngle",
    label: "Attack Angle",
    description: "정면/측면 보정값 확보 후 표시합니다.",
    status: "coming-soon",
  },
  {
    key: "threeDimensionalPath",
    label: "3D Club Path",
    description: "다중 시점 또는 캘리브레이션 정보가 확보되면 제공합니다.",
    status: "coming-soon",
  },
];

const resolveFilename = (input: any): string => {
  if (!input) return "";
  if (typeof input === "string") return input;
  return (
    input.filename ||
    (typeof input.file === "string" ? input.file : input.file?.filename) ||
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
  return rawUrl.url || (typeof rawUrl.file === "string" ? "" : rawUrl.file?.url) || rawUrl.shot?.url || "";
};

const resolveOriginalName = (input: any): string => {
  if (!input) return "";
  if (typeof input === "string") return input;
  return input.originalName || (typeof input.file === "string" ? "" : input.file?.originalName) || input.shot?.originalName || "";
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

const toOptionalNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeEvents = (
  events: any,
  eventQuality: EventValidation["eventQuality"] = {}
): Partial<Record<SwingEventKey, SwingEventTiming>> => {
  const keys: SwingEventKey[] = ["address", "takeaway", "top", "impact", "finish"];
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
      const quality = eventQuality?.[key];
      acc[key] = {
        timeMs: raw,
        quality: quality?.status,
        confidence: quality?.confidence,
        source: quality?.source,
      };
      return acc;
    }

    if (typeof raw === "object") {
      const timeMs = toNumberOrNull(raw.timeMs ?? raw.ms ?? raw.time);
      if (timeMs == null) return acc;
      acc[key] = {
        timeMs,
        frame: toNumberOrNull(raw.frame ?? raw.frameIndex) ?? undefined,
        label: raw.label ?? key,
        quality: eventQuality?.[key]?.status,
        confidence: eventQuality?.[key]?.confidence,
        source: eventQuality?.[key]?.source,
      };
    }

    return acc;
  }, {} as Partial<Record<SwingEventKey, SwingEventTiming>>);
};

const normalizeEventValidation = (raw: any): EventValidation | null => {
  if (!raw || typeof raw !== "object") return null;
  const status: EventValidation["status"] = raw.status === "withheld"
    ? "withheld"
    : raw.status === "partial"
      ? "partial"
      : "usable";
  const eventQuality = (["address", "takeaway", "top", "impact", "finish"] as SwingEventKey[]).reduce(
    (acc, key) => {
      const value = raw.eventQuality?.[key];
      if (!value || typeof value !== "object") return acc;
      const quality: EventEvidenceQuality["status"] = value.status === "confirmed"
        ? "confirmed"
        : value.status === "reference"
          ? "reference"
          : "withheld";
      acc[key] = {
        status: quality,
        confidence: toOptionalNumber(value.confidence),
        source: typeof value.source === "string" ? value.source : null,
      };
      return acc;
    },
    {} as NonNullable<EventValidation["eventQuality"]>
  );
  return {
    status,
    codes: Array.isArray(raw.codes) ? raw.codes.map(String) : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    message: typeof raw.message === "string" ? raw.message : null,
    eventQuality,
    metricAvailability: raw.metricAvailability && typeof raw.metricAvailability === "object"
      ? Object.fromEntries(Object.entries(raw.metricAvailability).map(([key, value]) => [key, String(value)]))
      : {},
    metricEvidence: raw.metricEvidence && typeof raw.metricEvidence === "object"
      ? Object.fromEntries(
          Object.entries(raw.metricEvidence).map(([key, value]: [string, any]) => {
            const status = value?.status === "confirmed"
              ? "confirmed"
              : value?.status === "reference"
                ? "reference"
                : "withheld";
            return [key, {
              status,
              reasons: Array.isArray(value?.reasons) ? value.reasons.map(String) : [],
              source: typeof value?.source === "string" ? value.source : null,
              observedFrames: toOptionalNumber(value?.observedFrames),
            }];
          })
        )
      : {},
  };
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
    ratio: normalizeTempoRatio(ratio),
  };
};

const normalizeTempoRatio = (value: any): string | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return `${Number(value.toFixed(2))}:1`;
  const text = String(value);
  if (text.includes(":")) return text;
  const num = Number(text);
  return Number.isFinite(num) ? `${Number(num.toFixed(2))}:1` : text;
};

const normalizeJobStatus = (status: any): JobStatus => {
  if (!status || typeof status !== "string") return "queued";
  switch (status.toLowerCase()) {
    case "idle":
      return "idle";
    case "not-analyzed":
    case "not_analyzed":
      return "not-analyzed";
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
      confidence: toOptionalNumber(ball.confidence),
    };
  }
  return undefined;
};

const normalizeMetricDetail = (value: any): AnalysisMetricDetail | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" || typeof value === "number") {
    return { label: String(value) };
  }
  if (typeof value !== "object") return undefined;

  const detail: AnalysisMetricDetail = {
    label:
      typeof value.label === "string"
        ? value.label
        : typeof value.name === "string"
        ? value.name
        : typeof value.type === "string"
        ? value.type
        : null,
    confidence: toOptionalNumber(value.confidence),
    score: toOptionalNumber(value.score),
    comment:
      typeof value.comment === "string"
        ? value.comment
        : typeof value.description === "string"
        ? value.description
        : null,
  };

  return detail.label || detail.confidence != null || detail.score != null || detail.comment
    ? detail
    : undefined;
};

const normalizeShaftPlane = (value: any): ShaftPlaneMetrics | undefined => {
  const base = normalizeMetricDetail(value);
  if (!base || typeof value !== "object") return base;
  return {
    ...base,
    angleDeg: toOptionalNumber(value.angleDeg ?? value.angle_deg),
    addressAngleDeg: toOptionalNumber(value.addressAngleDeg ?? value.address_angle_deg),
    sampleCount: toOptionalNumber(value.sampleCount ?? value.sample_count),
  };
};

const normalizeBackswing = (value: any): BackswingMetrics | undefined => {
  const base = normalizeMetricDetail(value);
  if (!base || typeof value !== "object") return base;
  return {
    ...base,
    clubTravelRatio: toOptionalNumber(value.clubTravelRatio ?? value.club_travel_ratio),
    topHeightRatio: toOptionalNumber(value.topHeightRatio ?? value.top_height_ratio),
  };
};

const normalizeReadiness = (value: any): ReadinessMetrics | undefined => {
  const base = normalizeMetricDetail(value);
  if (!base || typeof value !== "object") return base;
  return {
    ...base,
    readyFrames: toOptionalNumber(value.readyFrames ?? value.ready_frames),
    notReadyFrames: toOptionalNumber(value.notReadyFrames ?? value.not_ready_frames),
  };
};

const normalizeTrackingQuality = (value: any): TrackingQualityMetrics | undefined => {
  const base = normalizeMetricDetail(value);
  if (!base || typeof value !== "object") return base;
  return {
    ...base,
    frames: toOptionalNumber(value.frames),
    clubHeadFrames: toOptionalNumber(value.clubHeadFrames ?? value.club_head_frames),
    ambiguousClubHeadFrames: typeof value.ambiguousClubHeadFrames === "number" && Number.isSafeInteger(value.ambiguousClubHeadFrames) && value.ambiguousClubHeadFrames >= 0 ? value.ambiguousClubHeadFrames : null,
    ambiguousClubHandleFrames: typeof value.ambiguousClubHandleFrames === "number" && Number.isSafeInteger(value.ambiguousClubHandleFrames) && value.ambiguousClubHandleFrames >= 0 ? value.ambiguousClubHandleFrames : null,
    clubHandleFrames: toOptionalNumber(value.clubHandleFrames ?? value.club_handle_frames),
    clubFrames: toOptionalNumber(value.clubFrames ?? value.club_frames),
    ballFrames: toOptionalNumber(value.ballFrames ?? value.ball_frames),
    personFrames: toOptionalNumber(value.personFrames ?? value.person_frames),
    clubHeadConfidence: toOptionalNumber(value.clubHeadConfidence ?? value.club_head_confidence),
    clubHandleConfidence: toOptionalNumber(value.clubHandleConfidence ?? value.club_handle_confidence),
    clubConfidence: toOptionalNumber(value.clubConfidence ?? value.club_confidence),
    ballConfidence: toOptionalNumber(value.ballConfidence ?? value.ball_confidence),
    personConfidence: toOptionalNumber(value.personConfidence ?? value.person_confidence),
  };
};

const normalizeGenericMetricPayload = (value: any): GenericMetricPayload | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const base = normalizeMetricDetail(value) ?? {};
  return {
    ...value,
    ...base,
  };
};

const normalizeMetricGroup = (value: any): MetricGroup | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value)
    .map(([key, item]) => [key, normalizeGenericMetricPayload(item)] as const)
    .filter(([, item]) => item);

  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
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

const normalizeCoachFindings = (rawFindings: unknown): CoachFinding[] | undefined => {
  if (!Array.isArray(rawFindings)) return undefined;
  const findings = rawFindings
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      key: typeof item.key === "string" ? item.key : null,
      category: typeof item.category === "string" ? item.category : null,
      severity: typeof item.severity === "string" ? item.severity : null,
      confidence: toOptionalNumber(item.confidence),
      priority: typeof item.priority === "string" ? item.priority : null,
      evidence: typeof item.evidence === "string" ? item.evidence : null,
      interpretation: typeof item.interpretation === "string" ? item.interpretation : null,
      action: typeof item.action === "string" ? item.action : null,
      drill: typeof item.drill === "string" ? item.drill : null,
      checkpoint: typeof item.checkpoint === "string" ? item.checkpoint : null,
      caution: typeof item.caution === "string" ? item.caution : null,
      theory: typeof item.theory === "string" ? item.theory : null,
      evidenceLevel: typeof item.evidenceLevel === "string" ? item.evidenceLevel : null,
    }));
  return findings.length > 0 ? findings : undefined;
};

function normalizeClubObservations(raw: any): DtlClubPointsV2Sidecar["observations"] {
  if (raw?.revision !== 1 || raw?.automaticCoachingReady !== false || !Array.isArray(raw.levels)) return null;
  const edgeChecked = raw.edgeCheck === "bbox-v1";
  const levels: ClubObservationLevel[] = raw.levels.slice(0, 5).flatMap((row: any) => {
    const test = Array.isArray(row?.sensitivity) ? row.sensitivity.find((s: any) => s?.endpointRadiusPx === 5) : null;
    const values = [row?.heightFraction, row?.backswing?.timeMs, row?.downswing?.timeMs, row?.inclinationDifferenceDeg, test?.differenceBoundsDeg?.[0], test?.differenceBoundsDeg?.[1]];
    if (row?.status !== "observation" || !values.every(v => typeof v === "number" && Number.isFinite(v))
      || values[0] <= 0 || values[0] >= 1 || values[1] < 0 || values[2] <= values[1] || values[4] > values[5]
      || !["steeper", "flatter", "unresolved", "pair_uncertain"].includes(test?.direction)
      || (test.direction === "steeper" && values[4] <= 0) || (test.direction === "flatter" && values[5] >= 0)) return [];
    const larger = row.sensitivity.find((s: any) => s?.endpointRadiusPx === 10);
    const bounds = larger?.differenceBoundsDeg;
    const validBounds = Array.isArray(bounds) && bounds.length === 2 && bounds.every((v: any) => typeof v === "number" && Number.isFinite(v)) && bounds[0] <= bounds[1];
    const uncertainAt10 = validBounds && ((larger.direction === "unresolved" && larger.pairAvailabilityStable === true && bounds[0] <= 0 && bounds[1] >= 0)
      || (larger.direction === "pair_uncertain" && larger.pairAvailabilityStable === false));
    const selectedEdgeUnknown = [row.backswing, row.downswing].some((frame: any) =>
      [frame?.head, frame?.handle].some((point: any) => point?.frameEdge !== false));
    const frameEdgeReason = !edgeChecked ? "unverified" : test.frameEdgeRisk === true || selectedEdgeUnknown ? "possible" : undefined;
    const direction = frameEdgeReason ? "pair_uncertain" : test.direction;
    return [{ heightFraction: values[0], backswingMs: values[1], downswingMs: values[2], differenceDeg: values[3], lowerDeg: values[4], upperDeg: values[5], direction,
      ...(frameEdgeReason ? { frameEdgeReason } : {}),
      ...(["steeper", "flatter"].includes(direction) && uncertainAt10 ? { sensitiveTo10Px: true as const } : {}) }];
  });
  return { status: String(raw.status), levels, ...(raw.reason === "IMPACT_CANDIDATE_UNAVAILABLE" ? {reason: raw.reason} : {}) };
}

export const CLUB_BODY_UNAVAILABLE_MESSAGE = "자세 자료를 확인하지 못해 클럽 관측을 보류했어요. 업로드 탭에서 영상을 다시 선택해 새 기록으로 분석하거나 다시 촬영해 주세요.";

export async function waitForExistingClubReview(jobId: string, signal: AbortSignal, waitForStart = false): Promise<DtlClubPointsV2Sidecar | null> {
  let failures = 0;
  // shortcut: stop after 90 polls; use a job status stream for longer processing.
  for (let attempt = 0; attempt < 90 && !signal.aborted; attempt++) {
    let raw: any, responded = false;
    try {
      raw = await client.get(`/api/analyze/${encodeURIComponent(jobId)}/club-review`, { signal });
      responded = true;
      failures = 0;
    } catch (error) {
      if (signal.aborted) return null;
      if (++failures >= 3) throw error;
    }
    if (signal.aborted) return null;
    if (responded) {
      if (!raw || raw.ok !== true || raw.jobId !== jobId) throw new Error("다른 영상의 관측 응답입니다. 다시 시도해 주세요.");
      if (raw.sidecar != null && (typeof raw.sidecar !== "object" || Array.isArray(raw.sidecar) || typeof raw.sidecar.status !== "string")) throw new Error("관측 작업 상태를 확인하지 못했습니다.");
      const sidecar = normalizeAnalysis({ dtlClubPointsV2: raw.sidecar }, jobId).dtlClubPointsV2;
      if (sidecar && ["succeeded", "failed"].includes(sidecar.status)) return sidecar;
      if (sidecar && !["queued", "running"].includes(sidecar.status)) throw new Error("관측 작업 상태를 확인하지 못했습니다.");
      if (!sidecar && !waitForStart) return null;
    }
    if (attempt < 89 && !signal.aborted) await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return null;
}

export async function requestClubReview(jobId: string, signal: AbortSignal, refresh = false): Promise<DtlClubPointsV2Sidecar> {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const url = `/api/analyze/${encodeURIComponent(jobId)}/club-review`;
  const started = await client.post<{ ok?: boolean; refreshId?: string }>(url, new Blob([JSON.stringify(refresh ? { refresh: true } : {})], { type: "application/json" }));
  if (refresh && (started?.ok !== true || typeof started.refreshId !== "string")) {
    throw new Error("클럽 관측을 다시 계산할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
  for (let attempt = 0; attempt < 120; attempt++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const raw: any = await client.get(url, { signal });
    if (raw?.ok !== true || raw.jobId !== jobId) throw new Error("다른 영상의 관측 응답입니다. 다시 시도해 주세요.");
    const sidecar = normalizeAnalysis({ dtlClubPointsV2: raw.sidecar }, jobId).dtlClubPointsV2;
    if (refresh) {
      if (raw.refresh?.id !== started.refreshId) throw new Error("다른 관측 작업이 시작됐습니다. 다시 시도해 주세요.");
      if (["failed", "interrupted"].includes(raw.refresh.status)) throw new Error(raw.refresh.errorCode === "BODY_UNAVAILABLE" ? CLUB_BODY_UNAVAILABLE_MESSAGE : "클럽 관측을 다시 계산하지 못했습니다.");
      if (raw.refresh.status === "succeeded") {
        if (sidecar?.status === "succeeded") return sidecar;
        throw new Error("새 관측 결과를 확인하지 못했습니다.");
      }
      if (!["queued", "running"].includes(raw.refresh.status)) throw new Error("관측 작업 상태를 확인하지 못했습니다.");
      await new Promise(resolve => setTimeout(resolve, 2000));
      continue;
    }
    if (sidecar?.status === "failed") throw new Error(sidecar.errorCode === "BODY_UNAVAILABLE" ? CLUB_BODY_UNAVAILABLE_MESSAGE : "클럽 관측을 완료하지 못했습니다. 다시 시도해 주세요.");
    if (sidecar?.status === "succeeded") return sidecar;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error("관측이 아직 진행 중입니다. 잠시 후 다시 확인해 주세요.");
}

const normalizeOverlay = (raw: any): AnalysisOverlay | null => {
  if (!raw || typeof raw !== "object" || raw.coordinateSpace !== "normalized") return null;
  const point = (value: any) =>
    value && typeof value === "object" && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y))
      ? { x: Number(value.x), y: Number(value.y), confidence: toOptionalNumber(value.confidence),
          ...(typeof value.frameEdge === "boolean" ? { frameEdge: value.frameEdge } : {}) }
      : undefined;
  const poseFrames = Array.isArray(raw.poseFrames)
    ? raw.poseFrames
        .filter((frame: any) => frame && Number.isFinite(Number(frame.timeMs)) && frame.keypoints && typeof frame.keypoints === "object")
        .map((frame: any) => ({ timeMs: Number(frame.timeMs), frame: toOptionalNumber(frame.frame) ?? undefined, keypoints: frame.keypoints }))
    : [];
  const clubFrames = Array.isArray(raw.clubFrames)
    ? raw.clubFrames
        .filter((frame: any) => frame && Number.isFinite(Number(frame.timeMs)))
        .map((frame: any) => ({ timeMs: Number(frame.timeMs), frame: toOptionalNumber(frame.frame) ?? undefined, head: point(frame.head), handle: point(frame.handle), ...(frame.headBreakBefore === true ? { headBreakBefore: true } : {}), ...(frame.handleBreakBefore === true ? { handleBreakBefore: true } : {}), ...(typeof frame.headValidUntilMs === "number" && Number.isFinite(frame.headValidUntilMs) ? { headValidUntilMs: frame.headValidUntilMs } : {}), ...(typeof frame.handleValidUntilMs === "number" && Number.isFinite(frame.handleValidUntilMs) ? { handleValidUntilMs: frame.handleValidUntilMs } : {}) }))
    : [];
  return poseFrames.length || clubFrames.length ? { coordinateSpace: "normalized", clubTimeSource: raw.clubTimeSource === "video_pts" ? "video_pts" : undefined, poseFrames, clubFrames } : null;
};

export const normalizeAnalysis = (
  raw: any,
  jobId: string,
  status: JobStatus = "succeeded"
): AnalysisResult => {
  const metricsBlock = raw?.metrics ?? raw;
  const eventValidation = normalizeEventValidation(raw?.eventValidation);
  const events = normalizeEvents(raw?.events ?? metricsBlock?.events ?? raw, eventValidation?.eventQuality);
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
  const shaftPlaneRaw =
    metricsBlock?.shaftPlane ?? metricsBlock?.shaft_plane ?? raw?.shaftPlane ?? raw?.shaft_plane;
  const backswingRaw =
    metricsBlock?.backswing ?? metricsBlock?.backSwing ?? metricsBlock?.back_swing ?? raw?.backswing;
  const readinessRaw =
    metricsBlock?.readiness ?? metricsBlock?.readyState ?? metricsBlock?.ready_state ?? raw?.readiness;
  const trackingQualityRaw =
    metricsBlock?.trackingQuality ??
    metricsBlock?.tracking_quality ??
    raw?.trackingQuality ??
    raw?.tracking_quality;
  const bodyMetricsRaw = metricsBlock?.body ?? metricsBlock?.bodyMetrics ?? raw?.body ?? raw?.bodyMetrics;
  const clubMetricsRaw = metricsBlock?.club ?? metricsBlock?.clubMetrics ?? raw?.club ?? raw?.clubMetrics;
  const fusionMetricsRaw =
    metricsBlock?.fusion ?? metricsBlock?.fusionMetrics ?? raw?.fusion ?? raw?.fusionMetrics;
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
  const coachFindings = normalizeCoachFindings(
    raw?.coachFindings ?? raw?.coach_findings ?? raw?.debug?.coachFindings ?? raw?.debug?.coach_findings
  );
  const confidence = toOptionalNumber(raw?.confidence ?? metricsBlock?.confidence);
  const rawAnalysisQuality = raw?.analysisQuality ?? metricsBlock?.analysisQuality;
  const analysisQuality =
    rawAnalysisQuality && typeof rawAnalysisQuality === "object" && toOptionalNumber(rawAnalysisQuality.score) != null
      ? {
          label: typeof rawAnalysisQuality.label === "string" ? rawAnalysisQuality.label : "observation_coverage",
          score: toOptionalNumber(rawAnalysisQuality.score) ?? 0,
          meaning: typeof rawAnalysisQuality.meaning === "string" ? rawAnalysisQuality.meaning : null,
          components: rawAnalysisQuality.components && typeof rawAnalysisQuality.components === "object"
            ? {
                clubObservationCoverage: toOptionalNumber(rawAnalysisQuality.components.clubObservationCoverage),
                eventPathCoverage: toOptionalNumber(rawAnalysisQuality.components.eventPathCoverage),
                poseCoverage: toOptionalNumber(rawAnalysisQuality.components.poseCoverage),
              }
            : undefined,
        }
      : null;
  const overlay = normalizeOverlay(raw?.overlay ?? metricsBlock?.overlay);
  const rawDtlClubPointsV2 = raw?.debug?.dtlClubPointsV2 ?? raw?.dtlClubPointsV2;
  const dtlClubPointsV2: DtlClubPointsV2Sidecar | null =
    rawDtlClubPointsV2 && typeof rawDtlClubPointsV2 === "object"
      ? {
          status: typeof rawDtlClubPointsV2.status === "string" ? rawDtlClubPointsV2.status : "queued",
          model: typeof rawDtlClubPointsV2.model === "string" ? rawDtlClubPointsV2.model : null,
          overlay: normalizeOverlay(rawDtlClubPointsV2.overlay),
          pendingOverlay: normalizeOverlay(rawDtlClubPointsV2.pendingOverlay),
          sourceFrameCoverage: rawDtlClubPointsV2.sourceFrameCoverage?.status === "verified"
            && /^[a-f0-9]{64}$/.test(rawDtlClubPointsV2.overlayVideoSha256 ?? "")
            && rawDtlClubPointsV2.pendingOverlay?.clubTimeSource === "video_pts"
            && Array.isArray(rawDtlClubPointsV2.pendingOverlay?.clubFrames)
            && rawDtlClubPointsV2.pendingOverlay.clubFrames.length > 0
            && Number.isSafeInteger(rawDtlClubPointsV2.sourceFrameCoverage?.missingFrames)
            && rawDtlClubPointsV2.sourceFrameCoverage.missingFrames >= 0
            && rawDtlClubPointsV2.sourceFrameCoverage.missingFrames <= 7200
            ? { status: "verified", missingFrames: rawDtlClubPointsV2.sourceFrameCoverage.missingFrames }
            : { status: "unverified" },
          ...(Object.prototype.hasOwnProperty.call(rawDtlClubPointsV2, "overlayVideoSha256") ? {
            overlayVideoSha256: typeof rawDtlClubPointsV2.overlayVideoSha256 === "string" && /^[a-f0-9]{64}$/.test(rawDtlClubPointsV2.overlayVideoSha256)
              ? rawDtlClubPointsV2.overlayVideoSha256 : null,
          } : {}),
          observations: normalizeClubObservations(rawDtlClubPointsV2.observations),
          processingMs: toOptionalNumber(rawDtlClubPointsV2.processingMs ?? rawDtlClubPointsV2.processing_ms),
          takeaway:
            rawDtlClubPointsV2.takeaway && typeof rawDtlClubPointsV2.takeaway === "object"
              ? {
                  timeMs: toOptionalNumber(rawDtlClubPointsV2.takeaway.timeMs ?? rawDtlClubPointsV2.takeaway.time_ms),
                  status: typeof rawDtlClubPointsV2.takeaway.status === "string" ? rawDtlClubPointsV2.takeaway.status : null,
                  appliedToPrimary: rawDtlClubPointsV2.takeaway.appliedToPrimary === true,
                }
              : null,
          trackingQuality: normalizeTrackingQuality(rawDtlClubPointsV2.trackingQuality ?? rawDtlClubPointsV2.tracking_quality) ?? null,
          error: typeof rawDtlClubPointsV2.error === "string" ? rawDtlClubPointsV2.error : null,
          errorCode: rawDtlClubPointsV2.errorCode === "BODY_UNAVAILABLE" ? "BODY_UNAVAILABLE" : null,
          completedAt: typeof rawDtlClubPointsV2.completedAt === "string" ? rawDtlClubPointsV2.completedAt : null,
        }
      : null;
  const rawProgress = raw?.progress ?? metricsBlock?.progress;
  const progress: AnalysisProgress | null =
    rawProgress && typeof rawProgress === "object"
      ? {
          stage: String(rawProgress.stage ?? "unknown"),
          stageLabel:
            typeof rawProgress.stageLabel === "string" ? rawProgress.stageLabel : null,
          message: typeof rawProgress.message === "string" ? rawProgress.message : null,
          analysisPath:
            typeof rawProgress.analysisPath === "string" ? rawProgress.analysisPath : "unknown",
          metaPath: typeof rawProgress.metaPath === "string" ? rawProgress.metaPath : null,
          bodyPath: typeof rawProgress.bodyPath === "string" ? rawProgress.bodyPath : null,
          clubPath: typeof rawProgress.clubPath === "string" ? rawProgress.clubPath : null,
          fusionPath: typeof rawProgress.fusionPath === "string" ? rawProgress.fusionPath : null,
          detail:
            rawProgress.detail && typeof rawProgress.detail === "object"
              ? rawProgress.detail
              : null,
        }
      : null;

  return {
    jobId,
    status: normalizeJobStatus(status),
    analysisVersion:
      typeof raw?.analysisVersion === "string"
        ? raw.analysisVersion
        : typeof raw?.analysis_version === "string"
          ? raw.analysis_version
          : typeof metricsBlock?.analysisVersion === "string"
            ? metricsBlock.analysisVersion
            : typeof metricsBlock?.analysis_version === "string"
              ? metricsBlock.analysis_version
              : null,
    events,
    metrics: {
      tempo,
      eventTiming,
      ball,
      swingPlane: toText(swingPlaneRaw),
      swingPlaneDetail: normalizeMetricDetail(swingPlaneRaw),
      impactStability: toText(impactStabilityRaw),
      impactStabilityDetail: normalizeMetricDetail(impactStabilityRaw),
      shaftPlane: normalizeShaftPlane(shaftPlaneRaw),
      backswing: normalizeBackswing(backswingRaw),
      readiness: normalizeReadiness(readinessRaw),
      trackingQuality: normalizeTrackingQuality(trackingQualityRaw),
      body: normalizeMetricGroup(bodyMetricsRaw),
      club: normalizeMetricGroup(clubMetricsRaw),
      fusion: normalizeMetricGroup(fusionMetricsRaw),
    },
    pending: [...PENDING_METRICS],
    createdAt: raw?.createdAt ?? raw?.created_at,
    finishedAt: raw?.finishedAt ?? raw?.finished_at,
    errorMessage: raw?.errorMessage ?? raw?.error,
    summary,
    coachSummary: coachSummary?.map((item: any) => String(item)),
    coachFindings,
    confidence,
    analysisQuality,
    overlay,
    eventValidation,
    progress,
    dtlClubPointsV2,
  };
};

const withVideoUrl = (shot: Shot): Shot => {
  const filename = resolveFilename(shot);
  return {
    ...shot,
    filename,
    videoUrl: resolveMediaUrl(shot.videoUrl, filename),
    thumbnailUrl: shot.thumbnailUrl ? resolveMediaUrl(shot.thumbnailUrl, filename) : null,
  };
};

const mapToShot = (item: any): Shot => {
  const filename = resolveFilename(item);
  const jobId = item?.jobId ?? item?.analysis?.jobId ?? item?.id ?? filename;
  const analysis = item?.analysis
    ? normalizeAnalysis(
        { ...item.analysis, progress: item?.analysis?.progress ?? item?.progress },
        jobId,
        item.analysis.status ?? item?.status
      )
    : null;
  const analysisStatus = analysis?.status;
  const itemStatus = item?.status ? normalizeJobStatus(item.status) : undefined;
  const effectiveStatus = analysisStatus ?? itemStatus;
  const analyzedFlag =
    item?.analyzed ?? (Boolean(analysis && analysis.status === "succeeded") || effectiveStatus === "succeeded");

  return withVideoUrl({
    id: item?.id ?? jobId ?? filename,
    filename,
    jobId,
    sourceType: (item?.sourceType as SourceType) ?? "upload",
    videoUrl: resolveUrl(item) || item?.url,
    thumbnailUrl: item?.thumbnailUrl ?? item?.thumbnail_url ?? null,
    metaPath: item?.metaPath ?? item?.meta_path ?? null,
    originalName: resolveOriginalName(item) || undefined,
    createdAt: item?.createdAt ?? item?.uploadedAt ?? new Date().toISOString(),
    status: effectiveStatus,
    analyzed: analyzedFlag,
    modifiedAt: item?.modifiedAt,
    size: item?.size,
    errorCode: item?.errorCode ?? item?.analysis?.errorCode ?? null,
    errorMessage: item?.errorMessage ?? item?.analysis?.errorMessage ?? null,
    club: item?.club,
    analysis,
    nasArchive: item?.nasArchive ?? item?.nas_archive ?? null,
  } as Shot);
};

export const fetchShots = async (jobIds?: string[]): Promise<Shot[]> => {
  // 1) /api/files/detail (확장 스펙)
  try {
    const query = new URLSearchParams({ summary: "true" });
    if (jobIds) query.set("jobIds", jobIds.join(","));
    const detail = await client.get<FilesDetailRes>(`/api/files/detail?${query}`);
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
            sourceType: f.sourceType,
            metaPath: f.metaPath,
            analyzed: f.analyzed,
            status: f.status,
          analysis: f.analysis,
          progress: f.progress,
          size: f.size,
          modifiedAt: f.modifiedAt,
          thumbnailUrl: f.thumbnailUrl,
          errorCode: f.errorCode,
          errorMessage: f.errorMessage,
          nasArchive: f.nasArchive,
          })
        )
        .sort((a, b) => toTime(b.modifiedAt ?? b.createdAt) - toTime(a.modifiedAt ?? a.createdAt));
    }
  } catch (err) {
    if (jobIds || !isFallbackableApiError(err)) throw err;
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
    if (!isFallbackableApiError(err)) throw err;
    console.warn("fetchShots /api/files failed, fallback to legacy", err);
  }

  // 3) 레거시: /api/shots
  try {
    const data = await client.get<unknown>("/api/shots");
    if (Array.isArray(data)) {
      return (data as any[]).map((entry) => mapToShot(entry));
    }
  } catch (err) {
    throw err;
  }

  throw new Error("영상 목록 응답을 확인할 수 없습니다.");
};

export const retryNasArchive = async (jobId: string): Promise<{ scheduled: boolean }> => {
  const result = await client.post<{ scheduled?: boolean }>(
    `/api/archive/${encodeURIComponent(jobId)}/retry`,
    JSON.stringify({}),
  );
  return { scheduled: result.scheduled !== false };
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
    viewpoint?: "down_the_line" | "face_on";
    handedness?: "right" | "left";
    fps?: number;
    roi?: string;
    cam_distance?: number;
    cam_height?: number;
    h_fov?: number;
    v_fov?: number;
    impact_frame?: number;
    track_frames?: number;
    metaPath?: string | null;
  }
): Promise<Shot> => {
  const buildFormData = () => {
    const fd = new FormData();
    fd.append("video", file);
    fd.append("sourceType", sourceType);
    if (options?.club) fd.append("club", options.club);
    if (options?.viewpoint) fd.append("viewpoint", options.viewpoint);
    if (options?.handedness) fd.append("handedness", options.handedness);
    if (options?.fps != null) fd.append("fps", String(options.fps));
    if (options?.roi) fd.append("roi", options.roi);
    if (options?.cam_distance != null) fd.append("cam_distance", String(options.cam_distance));
    if (options?.cam_height != null) fd.append("cam_height", String(options.cam_height));
    if (options?.h_fov != null) fd.append("h_fov", String(options.h_fov));
    if (options?.v_fov != null) fd.append("v_fov", String(options.v_fov));
    if (options?.impact_frame != null) fd.append("impact_frame", String(options.impact_frame));
    if (options?.track_frames != null) fd.append("track_frames", String(options.track_frames));
    if (options?.metaPath) fd.append("metaPath", options.metaPath);
    return fd;
  };

  const send = async (url: string) => client.post<UploadRes>(url, buildFormData());

  let res: UploadRes;
  try {
    res = await send("/api/analyze");
  } catch (primaryError) {
    if (!(primaryError instanceof ApiError) || ![404, 405].includes(primaryError.status)) {
      throw primaryError;
    }
    console.warn("createAnalysisJob: /api/analyze unavailable, fallback to /api/upload?analyze=true", primaryError);
    res = await send("/api/upload?analyze=true");
  }

  if (res.ok === false) {
    throw new Error(res.errorMessage || res.message || res.error || "업로드/분석 요청 실패");
  }

  const filename = resolveFilename(res) || file.name;
  const fileUrl = typeof res.file === "string" ? "" : res.file?.url;
  const url = resolveUrl(res) || res.url || fileUrl || res.shot?.url;
  const originalName = resolveOriginalName(res) || file.name;
  const jobId = res.jobId ?? res.shot?.jobId ?? res.shotId ?? filename;
  const analysis = res.analysis
    ? normalizeAnalysis(
        { ...res.analysis, progress: res.analysis?.progress ?? res.progress },
        jobId,
        res.analysis.status ?? res.status
      )
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
    const rawAnalysis = {
      ...(res.analysis ?? res),
      progress: res.analysis?.progress ?? res.progress,
    };
    const analysis = normalizeAnalysis(rawAnalysis, res.jobId ?? jobId, status);
    console.log("[analysis-status]", {
      jobId: res.jobId ?? jobId,
      status,
      topLevelProgress: res.progress ?? null,
      analysisProgress: res.analysis?.progress ?? null,
      normalizedProgress: analysis?.progress ?? null,
      response: res,
    });
    return {
      jobId: res.jobId ?? jobId,
      status,
      analysis,
      errorMessage:
        res.errorMessage ??
        rawAnalysis?.errorMessage ??
        res.error ??
        rawAnalysis?.error ??
        res.message,
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
    const normalized = normalizeAnalysis(
      {
        ...(result.analysis ?? result),
        progress: result.analysis?.progress ?? result.progress,
      },
      jobId,
      status
    );
    console.log("[analysis-result]", {
      jobId,
      status,
      topLevelProgress: result.progress ?? null,
      analysisProgress: result.analysis?.progress ?? null,
      normalizedProgress: normalized?.progress ?? null,
      response: result,
    });
    return normalized;
  } catch (err) {
    console.warn("fetchAnalysisResult failed (ignored):", err);
    return null;
  }
};

// 호환성을 위해 유지
export const fetchAnalysis = fetchAnalysisResult;
export const createShot = createAnalysisJob;

export const createAnalysisJobForStoredUpload = async (
  filename: string,
  options?: { force?: boolean; club?: string; viewpoint?: "down_the_line" | "face_on"; handedness?: "right" | "left" }
): Promise<{ jobId: string; filename: string; status?: JobStatus }> => {
  const body = new Blob([JSON.stringify({ filename, options })], { type: "application/json" });
  const res = await client.post<{ ok?: boolean; jobId?: string; filename?: string; status?: string }>("/api/analyze/existing-upload", body);
  if (res.ok !== true || !res.jobId) throw new Error("저장된 영상의 분석을 시작하지 못했습니다.");
  return { jobId: res.jobId, filename: res.filename ?? filename, status: normalizeJobStatus(res.status) };
};

export const createAnalysisJobFromFile = async (
  filename: string,
  options?: {
    force?: boolean;
    jobId?: string;
    metaPath?: string | null;
    club?: string;
    viewpoint?: "down_the_line" | "face_on";
    handedness?: "right" | "left";
  }
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
      ...(options?.metaPath ? { metaPath: options.metaPath } : {}),
      ...(options?.force ? { force: true } : {}),
      options: {
        ...(options?.force ? { force: true } : {}),
        ...(options?.club ? { club: options.club } : {}),
        ...(options?.viewpoint ? { viewpoint: options.viewpoint } : {}),
        ...(options?.handedness ? { handedness: options.handedness } : {}),
      },
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
    errorMessage?: string;
  };
  if (json.ok === false) {
    throw new Error(json.error || json.errorMessage || "분석을 시작하지 못했습니다.");
  }
  return {
    jobId: json.jobId ?? derivedJobId,
    filename: json.filename ?? filename,
    status: normalizeJobStatus(json.status),
  };
};
