const EXPLICIT_BASE =
  (import.meta.env.VITE_BACK_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  "";
const LOCAL_BASE =
  (import.meta.env.VITE_BACK_BASE_URL_LOCAL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_LOCAL as string | undefined) ||
  "http://100.92.70.114:3000";
const PI_BASE =
  (import.meta.env.VITE_BACK_BASE_URL_PI as string | undefined) ||
  (import.meta.env.VITE_API_BASE_PI as string | undefined) ||
  "http://100.92.70.114:3000";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const guessBaseFromHost = (): string => {
  if (typeof window === "undefined") return LOCAL_BASE;
  const host = window.location.hostname;
  if (host === "raspberrypi.local" || host === "raspberrypi") return PI_BASE;
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return LOCAL_BASE;
  // IP로 접속한 경우 동일 호스트의 3000 포트를 기본 백엔드로 가정합니다.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return `http://${host}:3000`;
  return PI_BASE;
};

export const API_BASE = EXPLICIT_BASE || guessBaseFromHost();

const parseBody = (text: string): unknown => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const getErrorMessage = (body: unknown, fallback: string): string => {
  if (!body) return fallback;
  if (typeof body === "string") return body || fallback;
  if (typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  const message =
    record.errorMessage ??
    record.message ??
    record.error ??
    record.detail;
  return typeof message === "string" && message.trim() ? message : fallback;
};

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, options);
  const text = await res.text().catch(() => "");
  const body = parseBody(text);
  if (!res.ok) {
    throw new ApiError(getErrorMessage(body, res.statusText), res.status, body);
  }
  // 일부 엔드포인트가 빈 응답일 수 있으므로 안전하게 처리
  if (res.status === 204) return {} as T;
  return (body ?? {}) as T;
}

export const client = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: BodyInit) =>
    request<T>(url, { method: "POST", body }),
};
