export const API_BASE = import.meta.env.VITE_API_BASE || "";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || res.statusText);
  }
  // 일부 엔드포인트가 빈 응답일 수 있으므로 안전하게 처리
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

export const client = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: BodyInit) =>
    request<T>(url, { method: "POST", body }),
};
