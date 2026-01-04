export type CameraStatus = {
  ok?: boolean;
  cameraDetected: boolean;
  busy: boolean;
  streaming?: boolean;
  streamClients?: number;
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

export type CaptureH264Payload = {
  format: "h264";
  fps: number;
  durationSec: number;
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

export type CapturePayload = CaptureJpgPayload | CaptureH264Payload | CaptureMp4Payload;

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

export type AiConfigStatus = {
  current: string;
  options: string[];
  needsRestart?: boolean;
};

export type CalibrationListItem = {
  name: string;
};

export type CalibrationData = {
  name: string;
  data: {
    h_fov_deg?: number;
    v_fov_deg?: number;
    [key: string]: unknown;
  };
};
