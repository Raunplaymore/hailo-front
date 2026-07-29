import { API_BASE, client } from "./client";

export type DebugDetection = {
  label: string;
  classId: number | string | null;
  confidence: number;
  bbox: [number, number, number, number];
};

export type DebugKeypoint = [number, number, number];

export type DebugFrame = {
  index: number;
  frame: number;
  timeMs: number;
  imageUrl: string;
  detections: DebugDetection[];
  keypoints?: Record<string, DebugKeypoint> | null;
};

export type InferDebugFramesResponse = {
  ok: boolean;
  jobId: string;
  variant?: "main" | "debug" | string;
  metaPath: string;
  videoPath: string;
  meta: {
    fps: number | null;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    frames: number;
  };
  body?: {
    bodyPath: string | null;
    analysisVersion: string | null;
    poseAvailable: boolean | null;
    poseFrames: number | null;
    wristFrames: number | null;
  };
  labelCounts: Record<string, number>;
  frames: DebugFrame[];
};

export type InferDebugFramesProgressResponse = {
  ok: boolean;
  jobId: string;
  variant: "main" | "debug" | string;
  status: "idle" | "preparing" | "processing" | "succeeded" | "cancelled" | "failed";
  completed: number;
  total: number;
  percent: number;
  currentFrame?: number | null;
  startedAt?: string;
  updatedAt?: string;
};

export type DebugMetaResponse = {
  ok: boolean;
  jobId: string;
  metaPath: string | null;
  debugMetaPath: string | null;
  cached?: boolean;
};

export type InferDebugAnalysisResponse = {
  ok?: boolean;
  jobId?: string;
  status?: string;
  analysis?: {
    analysisVersion?: string | null;
    events?: Record<string, unknown> | null;
    metrics?: Record<string, unknown> | null;
    debug?: Record<string, unknown> | null;
  } | null;
};

export type ClubPreprocessLabVariant = {
  frames: number;
  detectedFrames: Record<string, number>;
  pairedHeadHandleFrames: number;
  shaftEvidenceScore: number;
};

export type ClubPreprocessLabResponse = {
  ok: boolean;
  jobId: string;
  labOnly: true;
  scorePath: string;
  archive?: {
    state: string;
    archiveJobId?: string;
    error?: string;
  };
  report: {
    decision: "candidate_for_visual_review" | "no_candidate";
    results: Record<string, ClubPreprocessLabVariant>;
    candidates: Array<{
      variant: string;
      scoreGain: number;
      headFrameGain: number;
      pairedFrameGain: number;
      qualifies: boolean;
    }>;
    guardrail: string;
  };
};

export type SwingTrackingPoint = {
  x: number;
  y: number;
  source: "manual" | "model";
};

export type SwingTrackingVisibility = "visible" | "occluded" | "out_of_frame" | "unknown";

export type SwingTrackingFrameLabel = {
  frame: number;
  timeMs: number;
  clubHead?: SwingTrackingPoint;
  clubHandle?: SwingTrackingPoint;
  clubHeadVisibility?: SwingTrackingVisibility;
  clubHandleVisibility?: SwingTrackingVisibility;
};

export type SwingTrackingEventLabel = {
  frame: number;
  timeMs: number;
  source: "manual" | "analysis";
};

export type SwingTrackingAnnotation = {
  schemaVersion: "swing-tracking-label-v1";
  jobId: string;
  viewpoint: "unknown" | "down_the_line" | "face_on";
  handedness: "unknown" | "right" | "left";
  status: "draft" | "reviewed";
  events: Record<"address" | "top" | "impact" | "finish", SwingTrackingEventLabel | null>;
  frames: SwingTrackingFrameLabel[];
  notes: string;
  source: {
    variant: "main" | "debug";
    analysisVersion: string | null;
    metaPath: string | null;
  };
  updatedAt?: string;
};

export type SwingTrackingAnnotationResponse = {
  ok: boolean;
  jobId: string;
  annotation: SwingTrackingAnnotation | null;
  annotationPath?: string;
};

export type SwingTrackingAnnotationListItem = {
  jobId: string;
  status: "draft" | "reviewed";
  viewpoint: "unknown" | "down_the_line" | "face_on";
  handedness: "right" | "left";
  labeledFrames: number;
  events: number;
  updatedAt: string | null;
  thumbnailUrl?: string | null;
};

export type SwingTrackingAnnotationListResponse = {
  ok: boolean;
  count: number;
  target: number;
  annotations: SwingTrackingAnnotationListItem[];
};

const withBaseUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url}`;
};

export async function fetchInferDebugFrames(
  jobId: string,
  options: {
    limit?: number;
    force?: boolean;
    variant?: "main" | "debug";
    signal?: AbortSignal;
  } = {}
) {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.force) params.set("force", "true");
  if (options.variant) params.set("variant", options.variant);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await client.get<InferDebugFramesResponse>(
    `/api/debug/infer/${encodeURIComponent(jobId)}/frames${suffix}`,
    { signal: options.signal }
  );
  return {
    ...response,
    frames: response.frames.map((frame) => ({
      ...frame,
      imageUrl: withBaseUrl(frame.imageUrl),
    })),
  };
}

export async function fetchInferDebugFramesProgress(
  jobId: string,
  options: { limit?: number; variant?: "main" | "debug"; signal?: AbortSignal } = {}
) {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.variant) params.set("variant", options.variant);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return client.get<InferDebugFramesProgressResponse>(
    `/api/debug/infer/${encodeURIComponent(jobId)}/frames/progress${suffix}`,
    { signal: options.signal }
  );
}

export async function generateInferDebugMeta(jobId: string) {
  return client.post<DebugMetaResponse>(
    `/api/debug/infer/${encodeURIComponent(jobId)}/debug-meta`,
    new Blob(["{}"], { type: "application/json" })
  );
}

export async function fetchInferDebugAnalysis(jobId: string) {
  return client.get<InferDebugAnalysisResponse>(`/api/analyze/${encodeURIComponent(jobId)}`);
}

export async function runClubPreprocessLab(jobId: string) {
  return client.post<ClubPreprocessLabResponse>(
    `/api/labs/club-preprocess/${encodeURIComponent(jobId)}`,
    new Blob(["{}"], { type: "application/json" })
  );
}

export async function fetchSwingTrackingAnnotation(jobId: string) {
  return client.get<SwingTrackingAnnotationResponse>(
    `/api/debug/infer/${encodeURIComponent(jobId)}/annotation`
  );
}

export async function fetchSwingTrackingAnnotations() {
  const response = await client.get<SwingTrackingAnnotationListResponse>(
    "/api/debug/swing-tracking/annotations"
  );
  return {
    ...response,
    annotations: response.annotations.map((annotation) => ({
      ...annotation,
      thumbnailUrl: annotation.thumbnailUrl ? withBaseUrl(annotation.thumbnailUrl) : null,
    })),
  };
}

export async function saveSwingTrackingAnnotation(
  jobId: string,
  annotation: SwingTrackingAnnotation
) {
  return client.post<SwingTrackingAnnotationResponse>(
    `/api/debug/infer/${encodeURIComponent(jobId)}/annotation`,
    new Blob([JSON.stringify(annotation)], { type: "application/json" })
  );
}
