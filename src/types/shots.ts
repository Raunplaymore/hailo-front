export type SourceType = "upload" | "camera";

export type JobStatus = "idle" | "queued" | "running" | "succeeded" | "failed" | "not-analyzed";

export type SwingEventKey = "address" | "top" | "impact" | "finish";

export type SwingEventTiming = {
  /** 해당 이벤트까지 경과 시간(ms) */
  timeMs: number;
  frame?: number;
  label?: string;
};

export type TempoMetrics = {
  /** 백스윙 소요 시간(ms) */
  backswingMs: number | null;
  /** 다운스윙 소요 시간(ms) */
  downswingMs: number | null;
  /** 백스윙:다운스윙 비율 문자열 */
  ratio: string | null;
};

export type EventTimingMetrics = Partial<Record<SwingEventKey, number | null>>;

export type BallMetrics = {
  launchDirection?: "left" | "center" | "right" | "unknown";
  launchAngle?: number | null;
  speedRelative?: "fast" | "medium" | "slow" | "unknown";
};

export type AnalysisMetrics = {
  tempo?: TempoMetrics;
  eventTiming?: EventTimingMetrics;
  ball?: BallMetrics;
  swingPlane?: string | null;
  impactStability?: string | null;
};

export type PendingMetric = {
  key: string;
  label: string;
  description: string;
  status: "coming-soon";
};

export type AnalysisResult = {
  jobId: string;
  status: JobStatus;
  events: Partial<Record<SwingEventKey, SwingEventTiming>>;
  metrics: AnalysisMetrics;
  pending: PendingMetric[];
  createdAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  summary?: string | null;
  coachSummary?: string[];
};

export type Shot = {
  id: string;
  filename: string;
  createdAt: string;
  sourceType: SourceType;
  videoUrl: string;
  originalName?: string;
  analyzed?: boolean;
  modifiedAt?: string;
  size?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  jobId?: string;
  status?: JobStatus;
  club?: string;
  analysis?: AnalysisResult | null;
};
