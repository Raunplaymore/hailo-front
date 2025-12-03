import { client, API_BASE } from "./client";
import { Shot, ShotAnalysis } from "../types/shots";

type UploadRes = { ok: boolean; file: string; shot?: Shot };
type FilesDetailRes = {
  ok: boolean;
  files: { filename: string; shotId?: string; analysis?: ShotAnalysis }[];
};

const resolveFilename = (shot: any): string => {
  return shot.filename || shot.media?.filename || "";
};

const withVideoUrl = (shot: Shot): Shot => {
  const filename = resolveFilename(shot);
  return {
    ...shot,
    filename,
    videoUrl: shot.videoUrl || `${API_BASE}/uploads/${encodeURIComponent(filename)}`,
  };
};

export const fetchShots = async (): Promise<Shot[]> => {
  // 1) 최신 백엔드: /api/shots
  try {
    const data = await client.get<unknown>("/api/shots");
    if (Array.isArray(data)) {
      return (data as Shot[]).map(withVideoUrl);
    }
    console.warn("fetchShots /api/shots returned non-array", data);
  } catch (err) {
    console.warn("fetchShots /api/shots failed, fallback to /api/files/detail", err);
  }

  // 2) fallback: /api/files/detail
  try {
    const detail = await client.get<unknown>("/api/files/detail");
    if (!detail || typeof detail !== "object" || !Array.isArray((detail as FilesDetailRes).files)) {
      console.warn("fetchShots fallback returned unexpected shape", detail);
      return [];
    }
    const filesDetail = detail as FilesDetailRes;
    const now = new Date().toISOString();
    return filesDetail.files.map((f) =>
      withVideoUrl({
        id: f.shotId || f.filename,
        filename: f.filename,
        videoUrl: `${API_BASE}/uploads/${encodeURIComponent(f.filename)}`,
        sourceType: "upload",
        createdAt: now,
        analysis: f.analysis,
      })
    );
  } catch (err) {
    console.error("fetchShots fallback failed", err);
    return [];
  }
};

export const fetchShot = async (id: string): Promise<Shot> => {
  try {
    const shot = await client.get<Shot>(`/api/shots/${encodeURIComponent(id)}`);
    return withVideoUrl(shot);
  } catch {
    // 최소 정보로 반환 (파일명으로 접근)
    return withVideoUrl({
      id,
      filename: id,
      videoUrl: `${API_BASE}/uploads/${encodeURIComponent(id)}`,
      sourceType: "upload",
      createdAt: new Date().toISOString(),
    });
  }
};

export const createShot = async (
  file: File,
  sourceType: "upload" | "camera" = "upload",
  club?: string
) => {
  const fd = new FormData();
  fd.append("video", file);
  fd.append("sourceType", sourceType);
  if (club) fd.append("club", club);
  const res = await client.post<UploadRes>("/api/upload?analyze=true", fd);
  if (res.shot) {
    return withVideoUrl(res.shot);
  }
  return withVideoUrl({
    id: res.file,
    filename: res.file,
    videoUrl: `${API_BASE}/uploads/${encodeURIComponent(res.file)}`,
    sourceType,
    createdAt: new Date().toISOString(),
  } as Shot);
};

export const fetchAnalysis = async (shotId: string): Promise<ShotAnalysis | null> => {
  try {
    const res = await client.get<{ analysis?: ShotAnalysis }>(
      `/api/shots/${encodeURIComponent(shotId)}/analysis`
    );
    return res.analysis ?? null;
  } catch (err) {
    console.warn("fetchAnalysis failed (ignored):", err);
    return null;
  }
};
