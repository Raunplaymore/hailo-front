import {
  CameraStatus,
  CameraStreamParams,
  CapturePayload,
  CaptureResponse,
} from "../types/camera";

export class CameraApiError extends Error {
  status?: number;
  body?: string;

  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, "");

const buildError = async (res: Response, fallback: string) => {
  const status = res.status;
  let bodyText: string | undefined;
  let bodyJson: { error?: string } | undefined;
  try {
    bodyJson = (await res.clone().json()) as { error?: string };
  } catch (_) {
    bodyText = await res.text();
  }

  const friendly = (() => {
    switch (status) {
      case 401:
        return "인증 실패(401): 토큰을 확인해주세요.";
      case 409:
        return "카메라 사용 중(409): 잠시 후 다시 시도하세요.";
      case 504:
        return "명령 타임아웃(504): 네트워크/카메라 상태를 확인하세요.";
      default:
        return fallback;
    }
  })();
  const message = bodyJson?.error || bodyText || `${friendly} (HTTP ${status})`;
  return new CameraApiError(message, status, bodyText);
};

const authHeaders = (token?: string) => (token ? { Authorization: `Bearer ${token}` } : {});

const ensureBaseUrl = (baseUrl: string) => {
  if (!baseUrl) {
    throw new CameraApiError("카메라 서버 주소를 입력하세요.");
  }
  return normalizeBaseUrl(baseUrl);
};

export const getStatus = async (baseUrl: string, token?: string): Promise<CameraStatus> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/camera/status`, {
    headers: {
      ...authHeaders(token),
    },
  });

  if (!res.ok) {
    throw await buildError(res, "카메라 상태를 불러오지 못했습니다.");
  }

  return (await res.json()) as CameraStatus;
};

export const startCapture = async (
  baseUrl: string,
  payload: CapturePayload,
  token?: string
): Promise<CaptureResponse> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/camera/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });

  const json = (await res.json()) as CaptureResponse & { error?: string };
  if (!res.ok || json.ok === false) {
    throw await buildError(res, json.error || "촬영을 시작하지 못했습니다.");
  }

  return json;
};

export const captureAndAnalyze = async (
  baseUrl: string,
  payload: CapturePayload,
  token?: string
): Promise<CaptureResponse> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/camera/capture-and-analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });

  const json = (await res.json()) as CaptureResponse & { error?: string };
  if (!res.ok || json.ok === false) {
    throw await buildError(res, json.error || "촬영+분석을 시작하지 못했습니다.");
  }

  return json;
};

export const buildStreamUrl = (baseUrl: string, params: CameraStreamParams): string => {
  const normalized = ensureBaseUrl(baseUrl);
  const url = new URL("/api/camera/stream.mjpeg", normalized);
  url.searchParams.set("width", String(params.width));
  url.searchParams.set("height", String(params.height));
  url.searchParams.set("fps", String(params.fps));
  if (params.token) {
    url.searchParams.set("token", params.token);
  }
  if (params.cacheBust) {
    url.searchParams.set("ts", String(params.cacheBust));
  }
  return url.toString();
};
