import {
  SessionFileItem,
  SessionLiveResponse,
  SessionStartResponse,
  SessionStopResponse,
} from "../types/session";

export class SessionApiError extends Error {
  status?: number;
  body?: string;

  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, "");

const authHeaders = (token?: string) => (token ? { Authorization: `Bearer ${token}` } : {});

const ensureBaseUrl = (baseUrl: string) => {
  if (!baseUrl) {
    throw new SessionApiError("카메라 서버 주소를 입력하세요.");
  }
  return normalizeBaseUrl(baseUrl);
};

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
  return new SessionApiError(message, status, bodyText);
};

const resolveJobId = (payload: any): string => {
  if (!payload) return "";
  return payload.jobId || payload.sessionId || payload.id || payload.job_id || "";
};

export const startSession = async (
  baseUrl: string,
  token?: string
): Promise<SessionStartResponse> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/session/start`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
    },
  });
  if (!res.ok) {
    throw await buildError(res, "세션을 시작하지 못했습니다.");
  }
  const json = (await res.json()) as Record<string, any>;
  const jobId = resolveJobId(json);
  if (!jobId) {
    throw new SessionApiError("세션 시작 응답에서 jobId를 찾지 못했습니다.");
  }
  return {
    jobId,
    ok: json.ok,
    status: json.status,
    startedAt: json.startedAt ?? json.started_at,
  };
};

export const stopSession = async (
  baseUrl: string,
  jobId: string,
  token?: string
): Promise<SessionStopResponse> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/session/${encodeURIComponent(jobId)}/stop`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
    },
  });
  if (!res.ok) {
    throw await buildError(res, "세션을 종료하지 못했습니다.");
  }
  const json = (await res.json()) as Record<string, any>;
  const resolvedJobId = resolveJobId(json) || jobId;
  return {
    jobId: resolvedJobId,
    filename: json.filename ?? json.file?.filename ?? json.video?.filename,
    url: json.url ?? json.file?.url ?? json.video?.url,
    videoUrl: json.videoUrl ?? json.video_url,
    metaPath: json.metaPath ?? json.meta_path,
    ok: json.ok,
    error: json.error,
  };
};

export const getSessionLive = async (
  baseUrl: string,
  jobId: string,
  tailFrames: number,
  token?: string,
  signal?: AbortSignal
): Promise<SessionLiveResponse> => {
  const normalized = ensureBaseUrl(baseUrl);
  const url = new URL(`/api/session/${encodeURIComponent(jobId)}/live`, normalized);
  url.searchParams.set("tailFrames", String(tailFrames));
  const res = await fetch(url.toString(), {
    headers: {
      ...authHeaders(token),
    },
    signal,
  });
  if (!res.ok) {
    throw await buildError(res, "라이브 프레임을 불러오지 못했습니다.");
  }
  return (await res.json()) as SessionLiveResponse;
};

export const listSessionFiles = async (
  baseUrl: string,
  token?: string
): Promise<SessionFileItem[]> => {
  const normalized = ensureBaseUrl(baseUrl);
  const res = await fetch(`${normalized}/api/files`, {
    headers: {
      ...authHeaders(token),
    },
  });
  if (!res.ok) {
    throw await buildError(res, "파일 목록을 불러오지 못했습니다.");
  }
  const json = (await res.json()) as any;
  const files = Array.isArray(json) ? json : Array.isArray(json?.files) ? json.files : [];
  return files
    .map((item: any) => {
      if (typeof item === "string") {
        return { filename: item } as SessionFileItem;
      }
      return {
        filename: item.filename ?? item.name ?? item.fileName ?? "",
        url: item.url ?? item.file?.url,
        createdAt: item.createdAt ?? item.created_at,
        modifiedAt: item.modifiedAt ?? item.modified_at,
        size: item.size ?? item.bytes,
        jobId: item.jobId ?? item.sessionId ?? item.job_id,
        status: item.status,
        metaPath: item.metaPath ?? item.meta_path,
        errorMessage: item.errorMessage ?? item.error,
      } as SessionFileItem;
    })
    .filter((item: SessionFileItem) => Boolean(item.filename));
};

export const resolveCameraFileUrl = (baseUrl: string, url: string | undefined, filename: string): string => {
  const normalized = ensureBaseUrl(baseUrl);
  if (url && typeof url === "string") {
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("/")) return `${normalized}${url}`;
    return `${normalized}/${url}`;
  }
  return `${normalized}/uploads/${encodeURIComponent(filename)}`;
};
