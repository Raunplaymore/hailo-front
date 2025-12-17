export type CameraStatus = {
  cameraDetected: boolean;
  busy: boolean;
  streaming?: boolean;
  lastCaptureAt?: string | null;
  lastError?: string | null;
};

export type CameraStreamParams = {
  width: number;
  height: number;
  fps: number;
  token?: string;
  cacheBust?: number;
};

export type CaptureJpgPayload = {
  format: "jpg";
  width: number;
  height: number;
  filename: string;
};

export type CaptureMp4Payload = {
  format: "mp4";
  fps: number;
  durationSec: number;
  width: number;
  height: number;
  filename: string;
};

export type CapturePayload = CaptureJpgPayload | CaptureMp4Payload;

export type CaptureResponse = {
  ok: boolean;
  filename: string;
  url?: string;
  jobId?: string;
  status?: string;
};

export type CaptureItem = {
  filename: string;
  url: string;
  format: CapturePayload["format"];
  createdAt: string;
  jobId?: string;
  status?: string;
};
