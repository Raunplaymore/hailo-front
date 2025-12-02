import { client, API_BASE } from "./client";
import { Shot } from "../types/shots";

type UploadRes = { ok: boolean; file: string };

// Backend 현재 엔드포인트: /api/files (GET), /api/upload (POST)
export const fetchShots = async (): Promise<Shot[]> => {
  const filenames = await client.get<string[]>("/api/files");
  const now = new Date().toISOString();
  return filenames.map((name) => ({
    id: name,
    filename: name,
    videoUrl: `${API_BASE}/uploads/${encodeURIComponent(name)}`,
    sourceType: "upload",
    createdAt: now,
  }));
};

export const fetchShot = async (id: string): Promise<Shot> => {
  // 최소 정보로 반환 (상세 API 없을 때 호환)
  return {
    id,
    filename: id,
    videoUrl: `${API_BASE}/uploads/${encodeURIComponent(id)}`,
    sourceType: "upload",
    createdAt: new Date().toISOString(),
  };
};

export const createShot = async (file: File, sourceType: "upload" | "camera" = "upload") => {
  const fd = new FormData();
  fd.append("video", file);
  fd.append("sourceType", sourceType);
  const res = await client.post<UploadRes>("/api/upload", fd);
  return {
    id: res.file,
    filename: res.file,
    videoUrl: `${API_BASE}/uploads/${encodeURIComponent(res.file)}`,
    sourceType,
    createdAt: new Date().toISOString(),
  } as Shot;
};
