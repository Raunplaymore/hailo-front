import {
  CameraStatus,
  CameraStreamParams,
  CapturePayload,
  CaptureResponse,
  AiConfigStatus,
  AutoRecordStatusResponse,
  CalibrationData,
  CalibrationListItem,
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
    // ignore
  }
  if (!bodyJson) {
    try {
      bodyText = await res.clone().text();
    } catch (_) {
      // ignore
    }
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

export const getAiConfig = async (baseUrl: string, token?: string): Promise<AiConfigStatus> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/camera/ai-config`, {
    headers: {
      ...authHeaders(token),
    },
  });

  if (!res.ok) {
    throw await buildError(res, "AI 설정을 불러오지 못했습니다.");
  }

  const json = (await res.json()) as { ok?: boolean } & AiConfigStatus;
  return {
    current: json.current,
    options: json.options || [],
    needsRestart: json.needsRestart,
  };
};

export const setAiConfig = async (
  baseUrl: string,
  name: string,
  token?: string
): Promise<AiConfigStatus> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/camera/ai-config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    throw await buildError(res, "AI 설정을 변경하지 못했습니다.");
  }

  const json = (await res.json()) as { ok?: boolean } & AiConfigStatus;
  return {
    current: json.current,
    options: json.options || [],
    needsRestart: json.needsRestart,
  };
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

export const stopStream = async (baseUrl: string, token?: string): Promise<void> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/camera/stream/stop`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
    },
  });
  if (!res.ok) {
    throw await buildError(res, "프리뷰 스트림을 종료하지 못했습니다.");
  }
};

export const listCalibrations = async (
  baseUrl: string,
  token?: string
): Promise<CalibrationListItem[]> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/camera/calibration/list`, {
    headers: {
      ...authHeaders(token),
    },
  });
  if (!res.ok) {
    throw await buildError(res, "캘리브레이션 목록을 불러오지 못했습니다.");
  }
  const json = (await res.json()) as { items?: string[] | CalibrationListItem[] };
  const items = Array.isArray(json?.items) ? json.items : [];
  return items.map((item) => (typeof item === "string" ? { name: item } : item));
};

export const getCalibration = async (
  baseUrl: string,
  name: string,
  token?: string
): Promise<CalibrationData> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/camera/calibration/${encodeURIComponent(name)}`, {
    headers: {
      ...authHeaders(token),
    },
  });
  if (!res.ok) {
    throw await buildError(res, "캘리브레이션 정보를 불러오지 못했습니다.");
  }
  const json = (await res.json()) as CalibrationData;
  return json;
};

export const getAutoRecordStatus = async (
  baseUrl: string,
  token?: string
): Promise<AutoRecordStatusResponse> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/camera/auto-record/status`, {
    headers: {
      ...authHeaders(token),
    },
  });
  if (!res.ok) {
    throw await buildError(res, "자동 녹화 상태를 불러오지 못했습니다.");
  }
  return (await res.json()) as AutoRecordStatusResponse;
};

export const startAutoRecord = async (
  baseUrl: string,
  token?: string
): Promise<AutoRecordStatusResponse> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/camera/auto-record/start`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
    },
  });
  const json = (await res.json()) as AutoRecordStatusResponse;
  if (!res.ok || json.ok === false) {
    throw await buildError(res, json.error || "자동 녹화를 시작하지 못했습니다.");
  }
  return json;
};

export const stopAutoRecord = async (
  baseUrl: string,
  token?: string
): Promise<AutoRecordStatusResponse> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/camera/auto-record/stop`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
    },
  });
  const json = (await res.json()) as AutoRecordStatusResponse;
  if (!res.ok || json.ok === false) {
    throw await buildError(res, json.error || "자동 녹화를 종료하지 못했습니다.");
  }
  return json;
};
