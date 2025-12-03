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
  openIds?: Set<string>;
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
  openIds,
}: ShotListProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-500">업로드된 파일</p>
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
          아직 등록된 파일이 없습니다.
        </div>
      ) : (
        <ul className="list-none p-0 m-0 grid gap-2">
          {shots.map((shot) => (
            <li
              key={shot.id}
              className="p-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-base break-words flex flex-col gap-3 w-full"
            >
              <div className="flex items-center justify-between gap-3 w-full">
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-semibold">{shot.filename}</span>
                  <span className="text-xs text-slate-500">
                    {shot.sourceType} · {shot.shot_type ?? "분류 없음"} · {new Date(shot.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => onSelect(shot)}
                    variant="outline"
                    className="w-auto px-3 py-1 text-sm"
                  >
                    {openIds?.has(shot.id) ? "접기" : "보기"}
                  </Button>
                  {onAnalyze && (
                    <Button
                      type="button"
                      onClick={() => onAnalyze(shot)}
                      variant="outline"
                      className="w-auto px-3 py-1 text-sm"
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
                      className="w-auto"
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
