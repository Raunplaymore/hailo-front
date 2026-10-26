import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMediaTitle } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { SessionRecord, SessionStatus } from "@/types/session";

type SessionListProps = {
  sessions: SessionRecord[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh: () => void;
  onSelect: (session: SessionRecord) => void;
  onDelete: (session: SessionRecord) => void;
  deletingId?: string | null;
  title?: string;
  emptyMessage?: string;
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  recording: "촬영 중",
  recorded: "촬영 완료",
  analyzing: "분석 중",
  done: "분석 완료",
  failed: "분석 실패",
};

export function SessionList({
  sessions,
  isLoading,
  error,
  onRefresh,
  onSelect,
  onDelete,
  deletingId,
  title = "스윙 세션 기록",
  emptyMessage = "아직 촬영된 세션이 없습니다.",
}: SessionListProps) {
  return (
    <Card className="min-w-0 max-w-full border-0 bg-transparent shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-3 px-0 pb-2 pt-0">
        <div className="min-w-0">
          <CardTitle className="text-sm text-muted-foreground">{title} · {sessions.length}개</CardTitle>
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
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            {isLoading ? "촬영 기록을 불러오는 중…" : error ? "연결을 확인하고 새로고침해 주세요." : emptyMessage}
          </div>
        ) : (
          <ul className="m-0 grid min-w-0 list-none gap-3 p-0">
            {sessions.map((session) => {
              const displayTitle = formatMediaTitle(session.filename);

              return (
                <li
                  key={session.id}
                  className="flex w-full min-w-0 flex-col gap-3 border-b border-border py-4 text-sm last:border-0"
                >
                  <div className="min-w-0 space-y-1">
                    <button type="button" disabled={session.status === "recording"} onClick={() => onSelect(session)} className="block min-h-12 w-full max-w-full break-words text-left text-sm font-semibold leading-5 [overflow-wrap:anywhere]" style={TITLE_CLAMP_STYLE}>
                      {displayTitle}
                    </button>
                  <span className="block break-words text-xs text-muted-foreground">
                    {STATUS_LABELS[session.status]} ·{" "}
                    {new Date(session.createdAt).toLocaleString()}
                  </span>
                  {session.status === "failed" && session.errorMessage && (
                    <p className="break-words text-xs text-red-300">
                      {session.errorMessage}
                    </p>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-border/70 pt-3">
                  <Button
                    type="button"
                    onClick={() => onSelect(session)}
                    variant="outline"
                    size="sm"
                    fullWidth={false}
                    disabled={session.status === "recording"}
                    className="gap-2"
                  >
                    {session.status === "analyzing" ? "진행 상황 보기" : "스윙 확인"}
                  </Button>
                    <Button type="button" onClick={() => onDelete(session)} variant="ghost" size="sm" fullWidth={false}
                      disabled={session.status === "recording" || deletingId === session.id} aria-label={`${displayTitle} 삭제`} className="gap-2 text-red-300"><Trash2 className="size-4" aria-hidden="true" />{deletingId === session.id ? "삭제 중" : "삭제"}</Button>
                  <details className="w-full rounded-lg bg-muted/30 px-3"><summary className="text-xs text-muted-foreground">촬영 기록 관리</summary><div className="space-y-2 pb-3">
                  {session.analysisJobId && (
                    <span className="block break-all text-xs text-muted-foreground">
                      Job ID: {session.analysisJobId}
                    </span>
                  )}

                  </div></details>
                </div>
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
