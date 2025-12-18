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
  onTitleClick?: (shot: Shot) => void;
  onAnalyze?: (shot: Shot) => void;
  onForceAnalyze?: (shot: Shot) => void;
  onRetake?: () => void;
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
  onTitleClick,
  onAnalyze,
  onForceAnalyze,
  onRetake,
  onDelete,
  deletingId,
  analyzingId,
  openIds,
  title = "업로드된 파일",
  emptyMessage = "아직 등록된 파일이 없습니다.",
}: ShotListProps) {
  const statusLabel = (status?: string, hasResult?: boolean) => {
    if (hasResult) return "분석 완료";
    switch (status) {
      case "not-analyzed":
        return "분석 전";
      case "queued":
        return "대기열";
      case "running":
        return "분석 중";
      case "succeeded":
        return "분석 없음";
      case "failed":
        return "실패";
      default:
        return "분석 전";
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
          {shots.map((shot) => {
            const effectiveStatus = (shot.status ?? shot.analysis?.status) as string | undefined;
            const isDone = effectiveStatus === "succeeded" && Boolean(shot.analysis);
            const isProcessing = effectiveStatus === "queued" || effectiveStatus === "running";
            const isFailed = effectiveStatus === "failed";
            const isNotSwing = isFailed && shot.errorCode === "NOT_SWING";
            const isAnalyzeAvailable = Boolean(onAnalyze) && !isDone && !isProcessing && !isNotSwing;
            const analyzeButtonLabel = isFailed ? "재시도" : "분석";
            return (
              <li
                key={shot.id}
                className="p-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-base break-words flex flex-col gap-3 w-full"
              >
                <div className="flex flex-col flex-1 min-w-0 gap-1">
                  {onTitleClick ? (
                    <button
                      type="button"
                      onClick={() => onTitleClick(shot)}
                      className="text-left font-semibold break-words text-sm text-blue-700 hover:underline"
                    >
                      {shot.originalName || shot.filename}
                    </button>
                  ) : (
                    <span className="font-semibold break-words text-sm">
                      {shot.originalName || shot.filename}
                    </span>
                  )}
                  <span className="text-xs text-slate-500 break-words">
                    {shot.sourceType} · {statusLabel(effectiveStatus, isDone)} ·{" "}
                    {new Date(shot.modifiedAt ?? shot.createdAt).toLocaleString()}
                  </span>
                  {isProcessing && (
                    <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-1 w-fit">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      분석중...
                    </span>
                  )}
                  {isDone && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-1 w-fit">
                      분석 완료
                    </span>
                  )}
                  {isNotSwing && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <p className="font-semibold">스윙 영상이 아닌 것 같아요</p>
                      <p className="text-xs text-amber-800 mt-1 break-words">
                        {shot.errorMessage || "스윙 동작이 충분히 담기지 않았을 수 있어요. 다시 촬영해 주세요."}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2 justify-end">
                        {onRetake && (
                          <Button
                            type="button"
                            onClick={onRetake}
                            variant="outline"
                            className="px-3 py-1 text-sm"
                            fullWidth={false}
                          >
                            다시 촬영
                          </Button>
                        )}
                        {onForceAnalyze && (
                          <Button
                            type="button"
                            onClick={() => onForceAnalyze(shot)}
                            variant="outline"
                            className="px-3 py-1 text-sm"
                            fullWidth={false}
                            disabled={analyzingId === shot.id}
                            isLoading={analyzingId === shot.id}
                            loadingText="분석중..."
                          >
                            강제 분석
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {isFailed && !isNotSwing && (shot.errorMessage || shot.errorCode) && (
                    <p className="text-xs text-red-600 break-words">
                      {shot.errorMessage || shot.errorCode}
                    </p>
                  )}
                  {shot.jobId && (
                    <span className="text-xs text-slate-400 break-words">Job ID: {shot.jobId}</span>
                  )}
                  <div className="flex flex-wrap items-center justify-end gap-2 mt-1">
                    <Button
                      type="button"
                      onClick={() => onSelect(shot)}
                      variant="outline"
                      className="px-3 py-1 text-sm"
                      fullWidth={false}
                    >
                      {openIds?.has(shot.id) ? "접기" : "보기"}
                    </Button>
                    {isAnalyzeAvailable && (
                      <Button
                        type="button"
                        onClick={() => onAnalyze(shot)}
                        variant="outline"
                        className="px-3 py-1 text-sm"
                        isLoading={analyzingId === shot.id}
                        loadingText="분석중..."
                        fullWidth={false}
                      >
                        {analyzeButtonLabel}
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
                      src={shot.videoUrl || `${API_BASE}/uploads/${encodeURIComponent(shot.filename)}`}
                    >
                      브라우저에서 video 태그를 지원하지 않습니다.
                    </video>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
