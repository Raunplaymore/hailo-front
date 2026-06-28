import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, formatMediaTitle } from "@/lib/utils";
import { Eye, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { API_BASE } from "../../api/client";
import { Shot } from "../../types/shots";

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
      <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
        <div className="min-w-0">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription className="break-words">
            업로드된 MP4/MOV 파일과 분석 상태를 확인하세요.
          </CardDescription>
        </div>
        <Button
          type="button"
          onClick={onRefresh}
          variant="outline"
          size="sm"
          fullWidth={false}
          className="shrink-0 rounded-lg"
          disabled={isLoading}
        >
          {isLoading ? "새로고침 중..." : "새로고침"}
        </Button>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        {shots.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {shots.map((shot) => {
              const displayTitle = formatMediaTitle(shot.filename, shot.originalName);
              const effectiveStatus = (shot.analysis?.status ?? shot.status) as string | undefined;
              const isDone = effectiveStatus === "succeeded" && Boolean(shot.analysis);
              const isProcessing = effectiveStatus === "queued" || effectiveStatus === "running";
              const isFailed = effectiveStatus === "failed";
              const isNotSwing = isFailed && shot.errorCode === "NOT_SWING";
              const isAnalyzeAvailable = Boolean(onAnalyze) && !isDone && !isProcessing && !isNotSwing;
              const analyzeButtonLabel = isFailed ? "재시도" : "분석";
              const isOpen = openIds?.has(shot.id);

              return (
                <li
                  key={shot.id}
                  className="flex w-full flex-col gap-3 break-words rounded-xl border border-border bg-card p-3 text-sm"
                >
                  <div className="min-w-0 space-y-1">
                    {onTitleClick ? (
                      <button
                        type="button"
                        onClick={() => onTitleClick(shot)}
                        className="block w-full text-left text-sm font-semibold leading-5 text-sky-200 hover:underline"
                        style={TITLE_CLAMP_STYLE}
                      >
                        {displayTitle}
                      </button>
                    ) : (
                      <span
                        className="block w-full text-sm font-semibold leading-5"
                        style={TITLE_CLAMP_STYLE}
                      >
                        {displayTitle}
                      </span>
                    )}
                    <span className="block break-words text-xs text-muted-foreground">
                      {shot.sourceType} · {statusLabel(effectiveStatus, isDone)} ·{" "}
                      {new Date(shot.modifiedAt ?? shot.createdAt).toLocaleString()}
                    </span>
                    {isProcessing && <Badge tone="processing">분석중...</Badge>}
                    {isDone && <Badge tone="success">분석 완료</Badge>}
                    {isNotSwing && (
                      <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <p className="font-semibold">스윙 영상이 아닌 것 같아요</p>
                        <p className="mt-1 break-words text-xs text-amber-800">
                          {shot.errorMessage ||
                            "스윙 동작이 충분히 담기지 않았을 수 있어요. 다시 촬영해 주세요."}
                        </p>
                        <div className="mt-2 flex flex-wrap justify-end gap-2">
                          {onRetake && (
                            <Button
                              type="button"
                              onClick={onRetake}
                              variant="outline"
                              size="sm"
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
                              size="sm"
                              fullWidth={false}
                              disabled={analyzingId === shot.id}
                            >
                              {analyzingId === shot.id ? "분석중..." : "강제 분석"}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    {isFailed && !isNotSwing && (shot.errorMessage || shot.errorCode) && (
                      <p className="break-words text-xs text-destructive">
                        {shot.errorMessage || shot.errorCode}
                      </p>
                    )}
                    {shot.jobId && (
                      <span className="text-xs text-muted-foreground">Job ID: {shot.jobId}</span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-3">
                    <Button
                      type="button"
                      onClick={() => onSelect(shot)}
                      variant="outline"
                      size="sm"
                      fullWidth={false}
                      className="gap-2"
                    >
                      {isOpen ? <RotateCcw className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span>{isOpen ? "접기" : "보기"}</span>
                    </Button>
                    {isAnalyzeAvailable && (
                      <Button
                        type="button"
                        onClick={() => onAnalyze?.(shot)}
                        variant="outline"
                        size="sm"
                        fullWidth={false}
                        disabled={analyzingId === shot.id}
                        className="gap-2"
                      >
                        {analyzingId === shot.id ? (
                          "분석중..."
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            <span>{analyzeButtonLabel}</span>
                          </>
                        )}
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        type="button"
                        onClick={() => onDelete(shot)}
                        variant="destructive"
                        size="icon"
                        fullWidth={false}
                        disabled={deletingId === shot.id}
                        className="shrink-0"
                        aria-label={deletingId === shot.id ? "삭제 중" : "삭제"}
                        title={deletingId === shot.id ? "삭제 중" : "삭제"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {isOpen && (
                    <div className="w-full">
                      <video
                        key={shot.id}
                        className="max-h-[480px] w-full rounded-lg border border-border object-contain"
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
      </CardContent>
    </Card>
  );
}

const TITLE_CLAMP_STYLE: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

function Badge({ tone, children }: { tone: "processing" | "success"; children: React.ReactNode }) {
  const styles =
    tone === "processing"
      ? "bg-sky-400/10 text-sky-100 border border-sky-300/30"
      : "bg-emerald-400/10 text-emerald-100 border border-emerald-300/30";
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold",
        styles
      )}
    >
      {tone === "processing" && <span className="h-2 w-2 animate-pulse rounded-full bg-sky-300" />}
      {children}
    </span>
  );
}
