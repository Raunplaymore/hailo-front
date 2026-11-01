import { API_BASE } from "./client";
import { deleteSession, listSessionFiles } from "./sessionApi";

export async function deleteRecording(filename: string, cameraBase: string, token?: string, expectedSessionId?: string) {
  if (!cameraBase) throw new Error("카메라 서버 주소를 확인해 주세요.");
  const matches = [];
  for (let offset = 0; offset <= 1000; offset += 200) {
    const page = await listSessionFiles(cameraBase, token, { limit: 200, offset });
    matches.push(...page.filter((session) => session.filename === filename));
    if (page.length < 200) break;
    if (offset === 1000) throw new Error("촬영 기록이 너무 많아 삭제할 대상을 확인할 수 없습니다.");
  }
  if (matches.length > 1 || (expectedSessionId && matches[0]?.jobId !== expectedSessionId)) {
    throw new Error("촬영 기록을 정확히 확인할 수 없습니다. 목록을 새로고침해 주세요.");
  }
  const session = matches[0];
  if (session && (!session.jobId || session.status === "running" || session.status === "recording")) {
    throw new Error("촬영 중이거나 촬영 ID가 없어 삭제할 수 없습니다.");
  }

  const list = await fetch(`${API_BASE}/api/files`);
  if (!list.ok) throw new Error("분석 기록을 확인하지 못했습니다. 다시 시도해 주세요.");
  const entries: unknown = await list.json();
  if (!Array.isArray(entries)) throw new Error("분석 기록을 확인하지 못했습니다.");
  const linked = entries.filter((entry) => entry && typeof entry === "object" && entry.filename === filename);
  if (linked.length > 1) throw new Error("연결된 분석 기록이 여러 개여서 삭제할 수 없습니다.");
  if (linked.length === 1) {
    const response = await fetch(`${API_BASE}/api/files/${encodeURIComponent(filename)}`, { method: "DELETE" });
    if (!response.ok) throw new Error("영상과 분석 기록을 삭제하지 못했습니다. 다시 시도해 주세요.");
  }
  if (session) {
    try {
      await deleteSession(cameraBase, session.jobId, filename, token);
    } catch (error) {
      if (linked.length) throw new Error("영상은 삭제됐지만 촬영 기록 정리에 실패했습니다. 촬영 기록에서 다시 삭제해 주세요.");
      throw error;
    }
  } else if (!linked.length) {
    throw new Error("삭제할 영상과 촬영 기록을 찾지 못했습니다.");
  }
}
