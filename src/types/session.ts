export type SessionState = "idle" | "recording" | "stopping" | "analyzing" | "done" | "failed";

export type SessionStatus = "recorded" | "analyzing" | "done" | "failed";

export type LiveOverlayBox = {
  xmin: number;
  ymin: number;
  width: number;
  height: number;
  label?: string;
  score?: number;
};

export type SessionLiveFrame = {
  frameId?: string | number;
  width?: number;
  height?: number;
  boxes?: LiveOverlayBox[];
  detections?: LiveOverlayBox[];
};

export type SessionLiveResponse = {
  jobId?: string;
  frames?: SessionLiveFrame[];
  boxes?: LiveOverlayBox[];
  detections?: LiveOverlayBox[];
};

export type SessionStartResponse = {
  jobId: string;
  ok?: boolean;
  status?: string;
  startedAt?: string;
};

export type SessionStopResponse = {
  jobId: string;
  filename?: string;
  url?: string;
  videoUrl?: string;
  metaPath?: string;
  ok?: boolean;
  error?: string;
};

export type SessionFileItem = {
  filename: string;
  url?: string;
  createdAt?: string;
  modifiedAt?: string;
  size?: number;
  jobId?: string;
  status?: string;
  metaPath?: string;
  errorMessage?: string;
};

export type SessionRecord = {
  id: string;
  filename: string;
  videoUrl: string;
  createdAt: string;
  status: SessionStatus;
  jobId?: string;
  analysisJobId?: string;
  metaPath?: string;
  errorMessage?: string;
};
