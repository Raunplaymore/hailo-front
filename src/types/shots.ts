export type SourceType = "upload" | "camera";

export type JobStatus = "idle" | "queued" | "running" | "succeeded" | "failed" | "not-analyzed";

export type SwingEventKey = "address" | "top" | "impact" | "finish";

export type SwingEventTiming = {
  /** 해당 이벤트까지 경과 시간(ms) */
  timeMs: number;
  frame?: number;
  label?: string;
  quality?: "confirmed" | "reference" | "withheld";
  confidence?: number | null;
  source?: string | null;
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
  confidence?: number | null;
};

export type AnalysisMetricDetail = {
  label?: string | null;
  confidence?: number | null;
  score?: number | null;
  comment?: string | null;
};

export type GenericMetricPayload = AnalysisMetricDetail & Record<string, unknown>;

export type MetricGroup = Record<string, GenericMetricPayload | null | undefined>;

export type ShaftPlaneMetrics = AnalysisMetricDetail & {
  angleDeg?: number | null;
  addressAngleDeg?: number | null;
  sampleCount?: number | null;
};

export type BackswingMetrics = AnalysisMetricDetail & {
  clubTravelRatio?: number | null;
  topHeightRatio?: number | null;
};

export type ReadinessMetrics = AnalysisMetricDetail & {
  readyFrames?: number | null;
  notReadyFrames?: number | null;
};

export type TrackingQualityMetrics = AnalysisMetricDetail & {
  frames?: number | null;
  clubHeadFrames?: number | null;
  clubHandleFrames?: number | null;
  clubFrames?: number | null;
  ballFrames?: number | null;
  personFrames?: number | null;
  clubHeadConfidence?: number | null;
  clubHandleConfidence?: number | null;
  clubConfidence?: number | null;
  ballConfidence?: number | null;
  personConfidence?: number | null;
};

export type AnalysisMetrics = {
  tempo?: TempoMetrics;
  eventTiming?: EventTimingMetrics;
  ball?: BallMetrics;
  swingPlane?: string | null;
  swingPlaneDetail?: AnalysisMetricDetail;
  impactStability?: string | null;
  impactStabilityDetail?: AnalysisMetricDetail;
  shaftPlane?: ShaftPlaneMetrics;
  backswing?: BackswingMetrics;
  readiness?: ReadinessMetrics;
  trackingQuality?: TrackingQualityMetrics;
  body?: MetricGroup;
  club?: MetricGroup;
  fusion?: MetricGroup;
};

export type PendingMetric = {
  key: string;
  label: string;
  description: string;
  status: "coming-soon";
};

export type AnalysisProgress = {
  stage: string;
  stageLabel?: string | null;
  message?: string | null;
  analysisPath?: "infer" | "opencv" | "pending" | "unknown" | string;
  metaPath?: string | null;
  bodyPath?: string | null;
  clubPath?: string | null;
  fusionPath?: string | null;
  detail?: Record<string, unknown> | null;
};

export type OverlayPoint = { x: number; y: number; confidence?: number | null };
export type OverlayPoseFrame = { timeMs: number; frame?: number; keypoints: Record<string, [number, number, number?]> };
export type OverlayClubFrame = { timeMs: number; frame?: number; head?: OverlayPoint; handle?: OverlayPoint };
export type AnalysisOverlay = {
  coordinateSpace: "normalized";
  poseFrames: OverlayPoseFrame[];
  clubFrames: OverlayClubFrame[];
};
export type EventEvidenceQuality = {
  status: "confirmed" | "reference" | "withheld";
  confidence?: number | null;
  source?: string | null;
};
export type MetricEvidence = {
  status: "confirmed" | "reference" | "withheld";
  reasons?: string[];
  source?: string | null;
  observedFrames?: number | null;
};
export type EventValidation = {
  status: "usable" | "partial" | "withheld";
  codes?: string[];
  warnings?: string[];
  message?: string | null;
  eventQuality?: Partial<Record<SwingEventKey, EventEvidenceQuality>>;
  metricAvailability?: Record<string, string>;
  metricEvidence?: Record<string, MetricEvidence>;
};

export type AnalysisQuality = {
  label: "observation_coverage" | string;
  score: number;
  meaning?: string | null;
  components?: {
    clubObservationCoverage?: number | null;
    eventPathCoverage?: number | null;
    poseCoverage?: number | null;
  };
};

export type AnalysisResult = {
  jobId: string;
  status: JobStatus;
  analysisVersion?: string | null;
  events: Partial<Record<SwingEventKey, SwingEventTiming>>;
  metrics: AnalysisMetrics;
  pending: PendingMetric[];
  createdAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  summary?: string | null;
  coachSummary?: string[];
  coachFindings?: CoachFinding[];
  confidence?: number | null;
  analysisQuality?: AnalysisQuality | null;
  overlay?: AnalysisOverlay | null;
  eventValidation?: EventValidation | null;
  progress?: AnalysisProgress | null;
};

export type CoachFinding = {
  key?: string | null;
  category?: string | null;
  severity?: string | null;
  confidence?: number | null;
  priority?: string | null;
  evidence?: string | null;
  interpretation?: string | null;
  action?: string | null;
  drill?: string | null;
  checkpoint?: string | null;
  caution?: string | null;
  theory?: string | null;
};

export type NasArchiveState = "disabled" | "pending" | "uploading" | "retrying" | "stored" | "failed";

export type NasArchiveStatus = {
  state: NasArchiveState;
  attempt?: number;
  retryAt?: string | null;
  archivedAt?: string | null;
  artifactCount?: number | null;
  videoStored?: boolean | null;
  error?: string | null;
  updatedAt?: string | null;
};

export type Shot = {
  id: string;
  filename: string;
  createdAt: string;
  sourceType: SourceType;
  videoUrl: string;
  thumbnailUrl?: string | null;
  metaPath?: string | null;
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
  nasArchive?: NasArchiveStatus | null;
};
