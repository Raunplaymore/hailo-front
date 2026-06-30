import { API_BASE, client } from "./client";

export type DebugDetection = {
  label: string;
  classId: number | string | null;
  confidence: number;
  bbox: [number, number, number, number];
};

export type DebugFrame = {
  index: number;
  frame: number;
  timeMs: number;
  imageUrl: string;
  detections: DebugDetection[];
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
  labelCounts: Record<string, number>;
  frames: DebugFrame[];
};

export type DebugMetaResponse = {
  ok: boolean;
  jobId: string;
  metaPath: string | null;
  debugMetaPath: string | null;
  cached?: boolean;
};

const withBaseUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url}`;
};

export async function fetchInferDebugFrames(
  jobId: string,
  options: { limit?: number; force?: boolean; variant?: "main" | "debug" } = {}
) {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.force) params.set("force", "true");
  if (options.variant) params.set("variant", options.variant);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await client.get<InferDebugFramesResponse>(
    `/api/debug/infer/${encodeURIComponent(jobId)}/frames${suffix}`
  );
  return {
    ...response,
    frames: response.frames.map((frame) => ({
      ...frame,
      imageUrl: withBaseUrl(frame.imageUrl),
    })),
  };
}

export async function generateInferDebugMeta(jobId: string) {
  return client.post<DebugMetaResponse>(
    `/api/debug/infer/${encodeURIComponent(jobId)}/debug-meta`,
    new Blob(["{}"], { type: "application/json" })
  );
}
