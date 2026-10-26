import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, formatMediaTitle } from "@/lib/utils";
import { Cloud, Image as ImageIcon, Trash2 } from "lucide-react";
import { API_BASE } from "../../api/client";
import { Shot } from "../../types/shots";

type ShotListProps = {
  shots: Shot[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh: () => void;
  onSelect: (shot: Shot) => void;
  onReview?: (shot: Shot) => void;
  onTitleClick?: (shot: Shot) => void;
  onAnalyze?: (shot: Shot) => void;
  onForceAnalyze?: (shot: Shot) => void;
  onRetake?: () => void;
  onDelete?: (shot: Shot) => void;
  onRetryArchive?: (shot: Shot) => void;
  deletingId?: string | null;
  analyzingId?: string | null;
  retryingArchiveId?: string | null;
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
  onReview,
  onAnalyze,
  onForceAnalyze,
  onRetake,
  onDelete,
  onRetryArchive,
  deletingId,
  analyzingId,
  retryingArchiveId,
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
    <Card className="min-w-0 max-w-full border-0 bg-transparent shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-3 px-0 pb-2 pt-0">
        <div className="min-w-0">
          <CardTitle className="text-sm text-muted-foreground">{title} · {shots.length}개</CardTitle>
        </div>
        <Button
          type="button"
          onClick={onRefresh}
          variant="outline"
          size="sm"
          fullWidth={false}
          className="self-start rounded-lg sm:shrink-0"
          disabled={isLoading}
        >
          {isLoading ? "새로고침 중..." : "새로고침"}
        </Button>
      </CardHeader>
      <CardContent className="min-w-0 px-0">
        {error && <p role="alert" className="mb-2 text-sm text-red-300">{error}</p>}
        {shots.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            {isLoading ? "영상을 불러오는 중…" : error ? "연결을 확인하고 새로고침해 주세요." : emptyMessage}
          </div>
        ) : (
          <ul className="m-0 grid min-w-0 list-none gap-3 p-0">
            {shots.map((shot) => {
              const displayTitle = formatMediaTitle(shot.filename, shot.originalName);
              const effectiveStatus = (shot.analysis?.status ?? shot.status) as string | undefined;
              const isDone = effectiveStatus === "succeeded";
              const isProcessing = effectiveStatus === "queued" || effectiveStatus === "running";
              const isFailed = effectiveStatus === "failed";
              const isNotSwing = isFailed && shot.errorCode === "NOT_SWING";
              const isAnalyzeAvailable = Boolean(onAnalyze) && !isDone && !isProcessing && !isNotSwing;
              const analyzeButtonLabel = isFailed ? "재시도" : "분석";
              const isOpen = openIds?.has(shot.id);
              const archive = shot.nasArchive;
              const archiveLabel =
                archive?.state === "stored" && archive.videoStored === false
                  ? "NAS 분석 보관 완료 · 원본 영상 없음"
                  : archive
                    ? NAS_ARCHIVE_LABELS[archive.state]
                    : null;
              const canRetryArchive = archive?.state === "failed" && Boolean(onRetryArchive && shot.jobId);

              return (
                <li
                  key={shot.id}
                  className="flex w-full min-w-0 flex-wrap items-start gap-3 border-b border-border py-4 text-sm last:border-0"
                >
                  <button type="button" aria-label={`${displayTitle} 열기`} onClick={() => shot.jobId && onReview ? onReview(shot) : onSelect(shot)} className="relative grid aspect-[4/3] w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground sm:w-36">
                    <ImageIcon className="h-6 w-6" aria-hidden="true" />
                    {shot.thumbnailUrl && (
                      <img
                        src={shot.thumbnailUrl}
                        alt={`${displayTitle} 썸네일`}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(event) => event.currentTarget.remove()}
                      />
                    )}
                  </button>

                  <div className="min-w-0 flex-1 space-y-1">
                    {onTitleClick ? (
                      <button
                        type="button"
                        onClick={() => shot.jobId ? onTitleClick(shot) : onSelect(shot)}
                        className="block min-h-12 w-full max-w-full break-words text-left text-sm font-semibold leading-5 text-foreground [overflow-wrap:anywhere] hover:underline"
                        style={TITLE_CLAMP_STYLE}
                      >
                        {displayTitle}
                      </button>
                    ) : (
                      <span
                        className="block w-full max-w-full break-words text-sm font-semibold leading-5 [overflow-wrap:anywhere]"
                        style={TITLE_CLAMP_STYLE}
                      >
                        {displayTitle}
                      </span>
                    )}
                    <span className="block break-words text-xs text-muted-foreground">
                      {statusLabel(effectiveStatus, isDone)} ·{" "}
                      {new Date(shot.modifiedAt ?? shot.createdAt).toLocaleString()}
                    </span>
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
                      <p className="break-words text-xs text-red-300">
                        {shot.errorMessage || shot.errorCode}
                      </p>
                    )}
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-end gap-2">
                    {isAnalyzeAvailable ? <Button type="button" size="sm" fullWidth={false} disabled={analyzingId === shot.id} onClick={() => onAnalyze?.(shot)}>{analyzingId === shot.id ? "요청 중…" : analyzeButtonLabel}</Button> : shot.jobId && onReview ? <Button type="button" variant="outline" size="sm" fullWidth={false} onClick={() => onReview(shot)}>{isProcessing ? "진행 상황 보기" : "스윙 확인"}</Button> : <Button type="button" variant="outline" size="sm" fullWidth={false} onClick={() => onSelect(shot)}>{isOpen ? "영상 접기" : "영상 보기"}</Button>}
                    {onDelete && <Button type="button" variant="ghost" size="sm" fullWidth={false} disabled={deletingId === shot.id} onClick={() => onDelete(shot)} aria-label={`${displayTitle} 삭제`} className="gap-2 text-red-300"><Trash2 className="size-4" aria-hidden="true" />{deletingId === shot.id ? "삭제 중" : "삭제"}</Button>}
                    <details className="min-w-0 flex-1 basis-full rounded-lg bg-muted/30 px-3">
                      <summary className="text-xs text-muted-foreground">영상 관리 · 원본 및 보관 상태</summary>
                      <div className="space-y-3 pb-3">
                    {archiveLabel && (
                      <Badge tone={archive?.state === "failed" ? "failed" : archive?.state === "stored" ? "success" : "processing"}>
                        <Cloud className="h-3 w-3" aria-hidden="true" />
                        {archiveLabel}
                      </Badge>
                    )}
                    {archive?.state === "failed" && archive.error && (
                      <p className="break-words text-xs text-red-300">NAS 보관 실패: {archive.error}</p>
                    )}
                        {shot.jobId && <p className="break-all text-xs text-muted-foreground">Job ID: {shot.jobId}</p>}
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" fullWidth={false} onClick={() => onSelect(shot)}>{isOpen ? "원본 접기" : "원본 보기"}</Button>
                          {canRetryArchive && <Button type="button" variant="outline" size="sm" fullWidth={false} disabled={retryingArchiveId === shot.id} onClick={() => onRetryArchive?.(shot)}>{retryingArchiveId === shot.id ? "NAS 재시도 중…" : "NAS 재시도"}</Button>}
                        </div>
                      </div>
                    </details>
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

const NAS_ARCHIVE_LABELS: Record<NonNullable<Shot["nasArchive"]>["state"], string> = {
  disabled: "NAS 보관 미설정",
  pending: "NAS 보관 대기",
  uploading: "NAS 보관 중",
  retrying: "NAS 재시도 대기",
  stored: "NAS 보관 완료",
  failed: "NAS 보관 실패",
};

function Badge({ tone, children }: { tone: "processing" | "success" | "failed"; children: React.ReactNode }) {
  const styles =
    tone === "processing"
      ? "bg-sky-400/10 text-sky-100 border border-sky-300/30"
      : tone === "failed"
        ? "bg-red-400/10 text-red-100 border border-red-300/30"
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
