import { Shot } from "../../types/shots";
import { Button } from "../Button";
import { Card } from "../Card";
import { API_BASE } from "../../api/client";

type ShotListProps = {
  shots: Shot[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh: () => void;
  onSelect: (shot: Shot) => void;
  onAnalyze?: (shot: Shot) => void;
  onDelete?: (shot: Shot) => void;
  deletingId?: string | null;
  analyzingId?: string | null;
  openIds?: Set<string>;
  title?: string;
  emptyMessage?: string;
};

export function ShotList({
  shots,
  isLoading,
  error,
  onRefresh,
  onSelect,
  onAnalyze,
  onDelete,
  deletingId,
  analyzingId,
  openIds,
  title = "업로드된 파일",
  emptyMessage = "아직 등록된 파일이 없습니다.",
}: ShotListProps) {
  const statusLabel = (status?: string, analyzed?: boolean) => {
    if (analyzed) return "분석 완료";
    switch (status) {
      case "queued":
        return "대기열";
      case "running":
        return "분석 중";
      case "succeeded":
        return "완료";
      case "failed":
        return "실패";
      default:
        return "대기";
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-500">{title}</p>
        <Button
          type="button"
          onClick={onRefresh}
          variant="outline"
          className="w-auto px-3 py-1 text-sm"
          isLoading={isLoading}
          loadingText="새로고침 중..."
        >
          새로고침
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {shots.length === 0 ? (
        <div className="p-4 rounded-xl border border-slate-200 text-slate-500 bg-slate-50">
          {emptyMessage}
        </div>
      ) : (
        <ul className="list-none p-0 m-0 grid gap-2">
        {shots.map((shot) => (
          <li
            key={shot.id}
            className="p-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-base break-words flex flex-col gap-3 w-full"
          >
            <div className="flex flex-col flex-1 min-w-0 gap-1">
              <span className="font-semibold break-words text-sm">{shot.filename}</span>
              <span className="text-xs text-slate-500 break-words">
                {shot.sourceType} · {statusLabel(shot.status ?? shot.analysis?.status, shot.analyzed)} ·{" "}
                {new Date(shot.createdAt).toLocaleString()}
              </span>
              {shot.analyzed && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-1 w-fit">
                  분석 완료
                </span>
              )}
              {shot.jobId && (
                <span className="text-xs text-slate-400 break-words">Job ID: {shot.jobId}</span>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2 mt-1 ">
                <Button
                  type="button"
                  onClick={() => onSelect(shot)}
                  variant="outline"
                  className="px-3 py-1 text-sm"
                  fullWidth={false}
                >
                  {openIds?.has(shot.id) ? "접기" : "보기"}
                </Button>
                {onAnalyze && !shot.analyzed && (
                  <Button
                    type="button"
                    onClick={() => onAnalyze(shot)}
                    variant="outline"
                    className="px-3 py-1 text-sm"
                    isLoading={analyzingId === shot.id}
                    loadingText="분석중..."
                    fullWidth={false}
                  >
                    분석
                  </Button>
                )}
                {onDelete && (
                  <Button
                    type="button"
                    onClick={() => onDelete(shot)}
                    isLoading={deletingId === shot.id}
                    loadingText="삭제중"
                    variant="danger"
                    fullWidth={false}
                    aria-label={`${shot.filename} 삭제`}
                  >
                    삭제
                  </Button>
                )}
              </div>
            </div>
            {openIds?.has(shot.id) && (
              <div className="w-full">
                <video
                  key={shot.id}
                    className="w-full rounded-lg border border-slate-200 max-h-[600px] object-contain"
                    controls
                    preload="metadata"
                    src={
                      shot.videoUrl ||
                      `${API_BASE}/uploads/${encodeURIComponent(shot.filename)}`
                    }
                  >
                    브라우저에서 video 태그를 지원하지 않습니다.
                  </video>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
